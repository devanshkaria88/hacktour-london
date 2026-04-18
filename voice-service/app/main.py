"""Second Voice — voice analysis sidecar.

Wraps Speechmatics batch transcription (medical domain) and Thymia Sentinel
biomarker streaming behind a single /analyze endpoint that the NestJS backend
calls. The endpoint accepts an audio file (any format ffmpeg can decode) and
returns a JSON document with the transcript and a flat biomarker dict aligned
with the backend's BiomarkersDto.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .analysis import AnalysisResult, AudioAnalyser

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("second-voice.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    analyser = AudioAnalyser()
    app.state.analyser = analyser
    logger.info(
        "voice service ready (speechmatics=%s, sentinel=%s)",
        analyser.speechmatics_enabled,
        analyser.sentinel_enabled,
    )
    yield


app = FastAPI(
    title="Second Voice — voice analysis service",
    description=(
        "Transcribes audio with Speechmatics medical-domain STT and extracts "
        "Thymia Sentinel voice biomarkers. Designed to sit behind the NestJS "
        "backend; not exposed to browsers."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    analyser: AudioAnalyser = app.state.analyser
    return {
        "status": "ok",
        "speechmatics_enabled": analyser.speechmatics_enabled,
        "sentinel_enabled": analyser.sentinel_enabled,
    }


@app.post("/analyze")
async def analyze(audio: UploadFile = File(...)) -> JSONResponse:
    if not audio.filename:
        raise HTTPException(status_code=400, detail="audio filename missing")

    suffix = os.path.splitext(audio.filename)[1] or ".bin"
    tmp_path = tempfile.NamedTemporaryFile(delete=False, suffix=suffix).name
    try:
        with open(tmp_path, "wb") as fh:
            shutil.copyfileobj(audio.file, fh)
        size = os.path.getsize(tmp_path)
        logger.info("received %s (%d bytes)", audio.filename, size)

        analyser: AudioAnalyser = app.state.analyser
        result: AnalysisResult = await analyser.analyse(tmp_path)
        return JSONResponse(content=result.to_dict())
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=False,
    )
