from __future__ import annotations

import os
from functools import lru_cache

from google.cloud import speech, texttospeech
from google.oauth2 import service_account
from pydantic import BaseModel

from app.config import get_settings


class TranscriptionResult(BaseModel):
    transcript: str
    confidence: float | None = None


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


def synthesize_speech(text: str) -> bytes:
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


def transcribe_audio(content: bytes, content_type: str | None) -> TranscriptionResult:
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
        return TranscriptionResult(transcript="", confidence=None)

    best = response.results[0].alternatives[0]
    transcript = " ".join(
        result.alternatives[0].transcript.strip()
        for result in response.results
        if result.alternatives
    ).strip()
    return TranscriptionResult(transcript=transcript, confidence=best.confidence or None)
