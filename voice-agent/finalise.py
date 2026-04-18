"""End-of-session finalisation: send captured audio to voice-service for biomarker
extraction, then post the resulting transcript + biomarkers to the backend.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("second-voice.agent.finalise")


class FinalisationError(RuntimeError):
    pass


async def analyse_audio(
    voice_service_url: str,
    wav_bytes: bytes,
    filename: str,
) -> Dict[str, Any]:
    """POST the captured WAV to the Python voice-service /analyze endpoint.

    Returns `{"transcript": str | None, "biomarkers": dict | None}`.
    """
    url = voice_service_url.rstrip("/") + "/analyze"
    timeout = httpx.Timeout(120.0, connect=10.0)
    files = {"audio": (filename, wav_bytes, "audio/wav")}
    logger.info("posting %.1f KB to %s", len(wav_bytes) / 1024, url)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, files=files)
    if resp.status_code >= 400:
        raise FinalisationError(
            f"voice-service /analyze returned {resp.status_code}: {resp.text[:300]}"
        )
    payload = resp.json()
    logger.info(
        "voice-service responded transcript_chars=%s biomarkers=%s",
        len(payload.get("transcript") or ""),
        "present" if payload.get("biomarkers") else "null",
    )
    return payload


async def post_checkin(
    backend_url: str,
    shared_secret: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """POST {transcript, biomarkers, audioDurationSec, sessionId} to the backend's
    /api/v1/checkins/from-session endpoint, authenticated by X-Agent-Secret.
    """
    url = backend_url.rstrip("/") + "/api/v1/checkins/from-session"
    headers = {
        "Content-Type": "application/json",
        "X-Agent-Secret": shared_secret,
    }
    timeout = httpx.Timeout(30.0, connect=10.0)
    logger.info("posting check-in to %s", url)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload, headers=headers)
    if resp.status_code >= 400:
        raise FinalisationError(
            f"backend /checkins/from-session returned {resp.status_code}: {resp.text[:300]}"
        )
    body = resp.json()
    logger.info(
        "backend persisted checkin id=%s divergence=%s",
        body.get("checkinId"),
        body.get("divergenceDetected"),
    )
    return body


async def finalise_session(
    *,
    user_id: str,
    session_id: str,
    wav_bytes: bytes,
    duration_seconds: float,
    questionnaire_responses: Optional[List[Dict[str, Any]]] = None,
    voice_service_url: Optional[str] = None,
    backend_url: Optional[str] = None,
    shared_secret: Optional[str] = None,
) -> Dict[str, Any]:
    voice_service_url = voice_service_url or os.environ["VOICE_SERVICE_URL"]
    backend_url = backend_url or os.environ["BACKEND_URL"]
    shared_secret = shared_secret or os.environ["VOICE_AGENT_SHARED_SECRET"]

    analysis = await analyse_audio(
        voice_service_url=voice_service_url,
        wav_bytes=wav_bytes,
        filename=f"{session_id}.wav",
    )

    payload: Dict[str, Any] = {
        "userId": user_id,
        "sessionId": session_id,
        "transcript": analysis.get("transcript"),
        "biomarkers": analysis.get("biomarkers"),
        "audioDurationSec": float(duration_seconds),
    }
    if questionnaire_responses:
        payload["questionnaireResponses"] = questionnaire_responses
        logger.info(
            "attaching %d questionnaire response(s) to checkin payload",
            len(questionnaire_responses),
        )

    return await post_checkin(
        backend_url=backend_url,
        shared_secret=shared_secret,
        payload=payload,
    )
