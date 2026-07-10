from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from google.api_core.exceptions import GoogleAPIError
from pydantic import BaseModel

from app.services.voice import synthesize_speech, transcribe_audio

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TtsResponseMeta(BaseModel):
    message: str


class SttResponse(BaseModel):
    transcript: str
    confidence: float | None = None
    provider: str | None = None


@router.post("/tts")
async def text_to_speech(text: str = Form(...)) -> Response:
    if not text.strip():
        raise HTTPException(status_code=422, detail="Text cannot be empty")

    try:
        audio_content, provider = await synthesize_speech(text.strip())
    except GoogleAPIError as exc:
        raise HTTPException(status_code=503, detail=f"Google TTS failed: {exc.message or type(exc).__name__}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Voice service unavailable: {type(exc).__name__}")

    return Response(
        content=audio_content,
        media_type="audio/mpeg",
        headers={"X-TTS-Provider": provider},
    )


@router.post("/stt", response_model=SttResponse)
async def speech_to_text(file: UploadFile = File(...)) -> SttResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded audio file is empty")

    try:
        result = await transcribe_audio(content, file.content_type)
    except GoogleAPIError as exc:
        raise HTTPException(status_code=503, detail=f"Speech recognition failed: {exc.message or type(exc).__name__}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Speech recognition unavailable: {type(exc).__name__}")

    if not result.transcript:
        raise HTTPException(status_code=422, detail="Could not detect any speech in the audio")

    return SttResponse(
        transcript=result.transcript,
        confidence=result.confidence,
        provider=result.provider,
    )
