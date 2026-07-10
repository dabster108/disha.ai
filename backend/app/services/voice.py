from __future__ import annotations

import os
from functools import lru_cache

import httpx
from google.cloud import speech, texttospeech
from google.oauth2 import service_account
from pydantic import BaseModel

from app.config import get_settings


class TranscriptionResult(BaseModel):
    transcript: str
    confidence: float | None = None
    provider: str | None = None


def _credentials():
    settings = get_settings()
    if settings.google_application_credentials:
        return service_account.Credentials.from_service_account_file(
            settings.google_application_credentials
        )
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return None
    return None


@lru_cache
def _tts_client() -> texttospeech.TextToSpeechClient:
    credentials = _credentials()
    return texttospeech.TextToSpeechClient(credentials=credentials) if credentials else texttospeech.TextToSpeechClient()


@lru_cache
def _stt_client() -> speech.SpeechClient:
    credentials = _credentials()
    return speech.SpeechClient(credentials=credentials) if credentials else speech.SpeechClient()


def _has_google_credentials() -> bool:
    settings = get_settings()
    if settings.google_application_credentials:
        return True
    return bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))


def synthesize_with_google(text: str) -> bytes:
    settings = get_settings()
    audio_encoding = getattr(
        texttospeech.AudioEncoding,
        settings.google_tts_audio_encoding.upper(),
        texttospeech.AudioEncoding.MP3,
    )
    request = texttospeech.SynthesizeSpeechRequest(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(
            language_code=settings.google_tts_language_code,
            name=settings.google_tts_voice_name,
        ),
        audio_config=texttospeech.AudioConfig(audio_encoding=audio_encoding),
    )
    response = _tts_client().synthesize_speech(request=request)
    return response.audio_content


async def synthesize_with_edge(text: str) -> bytes:
    import edge_tts

    settings = get_settings()
    communicate = edge_tts.Communicate(text, settings.edge_tts_voice)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    if not chunks:
        raise RuntimeError("edge-tts returned no audio")
    return b"".join(chunks)


async def synthesize_speech(text: str) -> tuple[bytes, str]:
    """Synthesize speech — Google Cloud TTS when configured, else edge-tts (no API key)."""
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Text cannot be empty")

    google_error: Exception | None = None
    if _has_google_credentials():
        try:
            return synthesize_with_google(cleaned), "google"
        except Exception as exc:
            google_error = exc

    try:
        audio = await synthesize_with_edge(cleaned)
        return audio, "edge"
    except Exception as edge_exc:
        if google_error is not None:
            raise RuntimeError(
                f"Google TTS failed ({google_error}); edge-tts failed ({edge_exc})"
            ) from edge_exc
        raise


def synthesize_speech_sync(text: str) -> bytes:
    """Sync wrapper kept for any legacy callers."""
    import asyncio

    audio, _ = asyncio.run(synthesize_speech(text))
    return audio


def _detect_encoding(content_type: str | None) -> speech.RecognitionConfig.AudioEncoding | None:
    normalized = (content_type or "").split(";")[0].strip().lower()
    return {
        "audio/webm": speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        "audio/ogg": speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
        "audio/wav": speech.RecognitionConfig.AudioEncoding.LINEAR16,
        "audio/x-wav": speech.RecognitionConfig.AudioEncoding.LINEAR16,
        "audio/mpeg": speech.RecognitionConfig.AudioEncoding.MP3,
        "audio/mp3": speech.RecognitionConfig.AudioEncoding.MP3,
    }.get(normalized)


def _audio_filename(content_type: str | None) -> str:
    normalized = (content_type or "").split(";")[0].strip().lower()
    ext = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
    }.get(normalized, "webm")
    return f"audio.{ext}"


def transcribe_with_google(content: bytes, content_type: str | None) -> TranscriptionResult:
    settings = get_settings()
    encoding = _detect_encoding(content_type)
    config_kwargs = dict(
        language_code=settings.google_stt_language_code,
        enable_automatic_punctuation=True,
        model="latest_long",
    )
    if encoding is not None:
        config_kwargs["encoding"] = encoding
    config = speech.RecognitionConfig(**config_kwargs)
    audio = speech.RecognitionAudio(content=content)
    response = _stt_client().recognize(config=config, audio=audio)

    if not response.results:
        return TranscriptionResult(transcript="", confidence=None, provider="google")

    best = response.results[0].alternatives[0]
    transcript = " ".join(
        result.alternatives[0].transcript.strip()
        for result in response.results
        if result.alternatives
    ).strip()
    return TranscriptionResult(
        transcript=transcript,
        confidence=best.confidence or None,
        provider="google",
    )


async def transcribe_with_groq(content: bytes, content_type: str | None) -> TranscriptionResult:
    settings = get_settings()
    if not settings.groq_api_key2:
        raise RuntimeError("Groq Whisper API key not configured")

    filename = _audio_filename(content_type)
    mime = (content_type or "audio/webm").split(";")[0].strip() or "audio/webm"

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.groq_api_key2}"},
            files={"file": (filename, content, mime)},
            data={
                "model": settings.groq_whisper_model,
                "language": "en",
                "response_format": "json",
            },
        )
        response.raise_for_status()
        payload = response.json()

    transcript = (payload.get("text") or "").strip()
    return TranscriptionResult(transcript=transcript, confidence=None, provider="groq")


async def transcribe_audio(content: bytes, content_type: str | None) -> TranscriptionResult:
    """Transcribe audio — Groq Whisper first, Google STT as fallback."""
    settings = get_settings()
    groq_error: Exception | None = None

    if settings.groq_api_key2:
        try:
            result = await transcribe_with_groq(content, content_type)
            if result.transcript:
                return result
        except Exception as exc:
            groq_error = exc

    try:
        return transcribe_with_google(content, content_type)
    except Exception as google_exc:
        if groq_error is not None:
            raise RuntimeError(
                f"Groq Whisper failed ({groq_error}); Google STT failed ({google_exc})"
            ) from google_exc
        raise
