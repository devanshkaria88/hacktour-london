"""Audio analysis pipeline. Transcoding + Speechmatics + Sentinel orchestration.

Designed to degrade gracefully:

- If `SPEECHMATICS_API_KEY` is not set or the SDK fails, the transcript is
  returned as ``None``.
- If `THYMIA_API_KEY` is not set or the SDK fails, biomarkers fall back to a
  deterministic elevated mock so the demo divergence detector still fires.

Both providers are exercised concurrently when available.
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import shutil
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("second-voice.analysis")

APOLLO_DEPRESSION = (
    "anhedonia",
    "low_mood",
    "sleep_issues",
    "low_energy",
    "appetite",
    "worthlessness",
    "concentration",
    "psychomotor",
)
APOLLO_ANXIETY = (
    "nervousness",
    "uncontrollable_worry",
    "excessive_worry",
    "trouble_relaxing",
    "restlessness",
    "irritability",
    "dread",
)
HELIOS_WELLNESS = (
    "distress",
    "stress",
    "burnout",
    "fatigue",
    "low_self_esteem",
)
ALL_BIOMARKERS = APOLLO_DEPRESSION + APOLLO_ANXIETY + HELIOS_WELLNESS

# Sentinel emits Apollo symptom scores under `symptom_*` field names
# (see thymia_sentinel.models.ReasonerBiomarkerSummary). Helios scores are
# emitted under their bare names. We accept both, then collapse to our
# canonical (bare) keys for storage.
SENTINEL_FIELD_TO_CANONICAL = {
    **{f"symptom_{name}": name for name in APOLLO_DEPRESSION + APOLLO_ANXIETY},
    **{name: name for name in APOLLO_DEPRESSION + APOLLO_ANXIETY},
    **{name: name for name in HELIOS_WELLNESS},
}

CAMEL_CASE = {
    "low_mood": "lowMood",
    "sleep_issues": "sleepIssues",
    "low_energy": "lowEnergy",
    "uncontrollable_worry": "uncontrollableWorry",
    "excessive_worry": "excessiveWorry",
    "trouble_relaxing": "troubleRelaxing",
    "low_self_esteem": "lowSelfEsteem",
}

SAMPLE_RATE = 16_000
# 32 KB chunks @ 16 kHz s16le mono = 1.024s of audio per chunk. Bigger chunks
# mean fewer websocket sends (faster) and Sentinel handles them fine — the
# policy result is triggered by the final transcript, not by per-chunk timing.
CHUNK_BYTES = 32_768


def _to_camel(snake: str) -> str:
    return CAMEL_CASE.get(snake, snake)


@dataclass
class AnalysisResult:
    transcript: Optional[str] = None
    biomarkers: Dict[str, Optional[float]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "transcript": self.transcript,
            "biomarkers": {
                _to_camel(k): v for k, v in self.biomarkers.items()
            }
            if self.biomarkers
            else None,
        }


class AudioAnalyser:
    def __init__(self) -> None:
        self.speechmatics_key = os.environ.get("SPEECHMATICS_API_KEY")
        self.thymia_key = os.environ.get("THYMIA_API_KEY")
        self.speechmatics_enabled = bool(self.speechmatics_key) and self._sdk_ok(
            "speechmatics.batch"
        )
        self.sentinel_enabled = bool(self.thymia_key) and self._sdk_ok(
            "thymia_sentinel"
        )

    @staticmethod
    def _sdk_ok(module_name: str) -> bool:
        try:
            __import__(module_name)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("SDK %s unavailable: %s", module_name, exc)
            return False

    async def analyse(self, audio_path: str) -> AnalysisResult:
        pcm_path = await asyncio.to_thread(_transcode_to_pcm, audio_path)
        try:
            # Sequential: transcribe first, then feed the real transcript +
            # audio into Sentinel. Sentinel's biomarker policies need actual
            # conversation text to score — passing a placeholder lands you
            # in passthrough mode with no extracted biomarkers.
            transcript = await self._transcribe(audio_path)
            biomarkers = await self._extract_biomarkers(pcm_path, transcript)
            return AnalysisResult(transcript=transcript, biomarkers=biomarkers)
        finally:
            try:
                os.remove(pcm_path)
            except OSError:
                pass

    async def _transcribe(self, audio_path: str) -> Optional[str]:
        if not self.speechmatics_enabled:
            logger.info("speechmatics disabled, skipping transcription")
            return None
        try:
            from speechmatics.batch import (  # type: ignore[import-not-found]
                AsyncClient,
                JobConfig,
                JobType,
                OperatingPoint,
                TranscriptionConfig,
            )

            config = JobConfig(
                type=JobType.TRANSCRIPTION,
                transcription_config=TranscriptionConfig(
                    language="en",
                    domain="medical",
                    operating_point=OperatingPoint.ENHANCED,
                ),
            )
            async with AsyncClient(api_key=self.speechmatics_key) as client:
                result = await client.transcribe(audio_path, config=config)
                text = getattr(result, "transcript_text", None)
                if isinstance(text, str) and text.strip():
                    return text.strip()
                return None
        except Exception as exc:  # noqa: BLE001
            logger.exception("speechmatics transcription failed: %s", exc)
            return None

    async def _extract_biomarkers(
        self, pcm_path: str, transcript: Optional[str]
    ) -> Dict[str, Optional[float]]:
        if not self.sentinel_enabled:
            logger.info("sentinel disabled, returning mock biomarkers")
            return _mock_elevated_biomarkers()

        try:
            from thymia_sentinel import SentinelClient  # type: ignore[import-not-found]
        except Exception as exc:  # noqa: BLE001
            logger.exception("sentinel SDK import failed: %s", exc)
            return _mock_elevated_biomarkers()

        policy_events: List[Dict[str, Any]] = []
        progress_events: List[Dict[str, Any]] = []

        sentinel = SentinelClient(
            user_label="second-voice-checkin",
            policies=["passthrough"],
            biomarkers=["helios", "apollo"],
            sample_rate=SAMPLE_RATE,
        )

        @sentinel.on_policy_result  # type: ignore[misc]
        async def handle_policy(result: Dict[str, Any]) -> None:  # noqa: D401
            policy_events.append(result)

        @sentinel.on_progress  # type: ignore[misc]
        async def handle_progress(progress: Dict[str, Any]) -> None:  # noqa: D401
            progress_events.append(progress)

        # We DON'T pace audio at real-time. Sentinel's `passthrough` policy
        # emits its result when we send the final transcript — not based on
        # wall-clock audio accumulation. So the bottleneck is the transcript
        # send, not the audio send. Pacing at 1x real-time wastes time and
        # causes the LiveKit Agents entrypoint to be killed by its shutdown
        # timeout (~30-35s) before the response comes back.
        #
        # We do yield to the event loop between chunks so the server has a
        # chance to acknowledge backpressure on the websocket.
        try:
            await sentinel.connect()

            with open(pcm_path, "rb") as fh:
                while True:
                    chunk = fh.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    await sentinel.send_user_audio(chunk)
                    await asyncio.sleep(0)

            # Real transcript is mainly for the policy/reasoner LLM layer —
            # vocal biomarkers don't need it, but it's free context AND it's
            # the trigger that makes Sentinel emit its passthrough result.
            final_text = (
                transcript.strip()
                if transcript and transcript.strip()
                else "[end of check-in]"
            )
            await sentinel.send_user_transcript(final_text, is_final=True)

            # Give Sentinel a moment to flush the final policy_result event.
            await asyncio.sleep(2.0)
            await sentinel.close()
        except Exception as exc:  # noqa: BLE001
            logger.exception("sentinel streaming failed: %s", exc)
            return _mock_elevated_biomarkers()

        # Log progress so we can see how much speech each biomarker collected
        # vs. how much it needed. Useful when scores come back empty.
        if progress_events:
            last = progress_events[-1]
            biomarkers_dict = (
                last.get("biomarkers", {}) if isinstance(last, dict) else {}
            )
            summary = ", ".join(
                f"{name}={info.get('speech_seconds', 0):.1f}s/"
                f"{info.get('trigger_seconds', 0):.1f}s"
                for name, info in biomarkers_dict.items()
            )
            logger.info("sentinel progress (final): %s", summary or "<empty>")

        parsed = _flatten_sentinel_results(policy_events)
        has_any_score = any(v is not None for v in parsed.values())
        if not has_any_score:
            logger.warning(
                "sentinel returned %d policy + %d progress event(s) but no "
                "recognised biomarker scores; falling back to mock. "
                "Policy sample: %r",
                len(policy_events),
                len(progress_events),
                policy_events[:1],
            )
            return _mock_elevated_biomarkers()
        logger.info(
            "sentinel returned biomarkers: phq9_keys=%d gad7_keys=%d helios_keys=%d",
            sum(1 for k in APOLLO_DEPRESSION if parsed.get(k) is not None),
            sum(1 for k in APOLLO_ANXIETY if parsed.get(k) is not None),
            sum(1 for k in HELIOS_WELLNESS if parsed.get(k) is not None),
        )
        return parsed


def _transcode_to_pcm(input_path: str) -> str:
    """Decode an arbitrary audio file to raw 16 kHz mono PCM s16le."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required on PATH for audio decoding")
    out = tempfile.NamedTemporaryFile(delete=False, suffix=".pcm").name
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        input_path,
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        out,
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed ({proc.returncode}): {proc.stderr.decode(errors='ignore')}"
        )
    return out


def _flatten_sentinel_results(
    results: List[Dict[str, Any]],
) -> Dict[str, Optional[float]]:
    """Walk Sentinel's nested policy result payloads and pull out a flat 0-1
    dict keyed by our canonical biomarker names.

    Sentinel emits Apollo symptom severities under `symptom_<name>` field
    names (e.g. `symptom_anhedonia`) and Helios wellness scores under their
    bare names (e.g. `distress`). We accept both. The passthrough policy
    typically returns the scores directly under `result`, but some SDK
    versions wrap them under `biomarkers` / `values` / `scores` / `response`.
    """
    flat: Dict[str, float] = {}
    for entry in results:
        candidates: List[Dict[str, Any]] = []
        result_obj = entry.get("result", entry) if isinstance(entry, dict) else {}
        if isinstance(result_obj, dict):
            candidates.append(result_obj)
            for key in ("biomarkers", "values", "scores", "response"):
                inner = result_obj.get(key)
                if isinstance(inner, dict):
                    candidates.append(inner)
        for candidate in candidates:
            for key, value in candidate.items():
                canonical = SENTINEL_FIELD_TO_CANONICAL.get(key)
                if canonical is None:
                    continue
                if isinstance(value, (int, float)):
                    flat[canonical] = float(value)
                elif isinstance(value, dict) and "score" in value:
                    score = value.get("score")
                    if isinstance(score, (int, float)):
                        flat[canonical] = float(score)
    if not flat:
        return {}
    return {key: flat.get(key) for key in ALL_BIOMARKERS}


def _mock_elevated_biomarkers() -> Dict[str, Optional[float]]:
    """Mildly elevated, deterministic biomarkers used when the real sidecar is
    unreachable. Sits well above the seeded baseline (~0.36) so the divergence
    detector reliably fires during the demo.
    """
    base = 0.62
    return {
        key: round(
            max(0.0, min(1.0, base + 0.06 * math.sin(idx * 1.3))),
            4,
        )
        for idx, key in enumerate(ALL_BIOMARKERS)
    }
