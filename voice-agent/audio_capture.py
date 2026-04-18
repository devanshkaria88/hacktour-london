"""Capture user audio in a LiveKit room and write it to a WAV file at session end.

We hook into the room's `track_subscribed` event, look for the participant's
microphone audio track, and stream raw PCM frames into an in-memory buffer.
At the end of the session we materialise the buffer to a 16 kHz mono WAV that
the voice-service can analyse with Speechmatics + Sentinel.
"""

from __future__ import annotations

import asyncio
import io
import logging
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from livekit import rtc

logger = logging.getLogger("second-voice.agent.capture")

SAMPLE_RATE = 16_000
NUM_CHANNELS = 1
SAMPLE_WIDTH_BYTES = 2  # 16-bit PCM


@dataclass
class CapturedAudio:
    pcm_chunks: List[bytes] = field(default_factory=list)
    started_at: Optional[float] = None
    last_frame_at: Optional[float] = None

    @property
    def has_audio(self) -> bool:
        return any(len(c) > 0 for c in self.pcm_chunks)

    @property
    def duration_seconds(self) -> float:
        total_bytes = sum(len(c) for c in self.pcm_chunks)
        total_samples = total_bytes // (SAMPLE_WIDTH_BYTES * NUM_CHANNELS)
        return total_samples / SAMPLE_RATE

    def write_wav(self, target: Path) -> Path:
        target.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(target), "wb") as wav:
            wav.setnchannels(NUM_CHANNELS)
            wav.setsampwidth(SAMPLE_WIDTH_BYTES)
            wav.setframerate(SAMPLE_RATE)
            for chunk in self.pcm_chunks:
                wav.writeframes(chunk)
        return target

    def to_wav_bytes(self) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(NUM_CHANNELS)
            wav.setsampwidth(SAMPLE_WIDTH_BYTES)
            wav.setframerate(SAMPLE_RATE)
            for chunk in self.pcm_chunks:
                wav.writeframes(chunk)
        return buf.getvalue()


class UserAudioCapture:
    """Subscribes to the first remote audio track that appears in the room and
    keeps streaming PCM into `CapturedAudio` until `stop()` is called.
    """

    def __init__(self, room: rtc.Room) -> None:
        self.room = room
        self.captured = CapturedAudio()
        self._consumer_task: Optional[asyncio.Task] = None
        self._stream: Optional[rtc.AudioStream] = None
        self._subscribed_identity: Optional[str] = None
        self._loop = asyncio.get_event_loop()

    def attach(self) -> None:
        self.room.on("track_subscribed", self._on_track_subscribed)
        self.room.on("track_unsubscribed", self._on_track_unsubscribed)
        # Also handle tracks that were subscribed before we attached.
        for participant in self.room.remote_participants.values():
            for publication in participant.track_publications.values():
                if publication.track is not None and publication.kind == rtc.TrackKind.KIND_AUDIO:
                    self._on_track_subscribed(publication.track, publication, participant)

    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        if self._consumer_task is not None and not self._consumer_task.done():
            logger.debug("audio capture already running, ignoring extra track from %s", participant.identity)
            return
        logger.info("subscribed to audio track from %s", participant.identity)
        self._subscribed_identity = participant.identity
        self._stream = rtc.AudioStream(
            track,
            sample_rate=SAMPLE_RATE,
            num_channels=NUM_CHANNELS,
        )
        self._consumer_task = self._loop.create_task(self._consume(self._stream))

    def _on_track_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if participant.identity == self._subscribed_identity:
            logger.info("audio track from %s was unsubscribed", participant.identity)

    async def _consume(self, stream: rtc.AudioStream) -> None:
        try:
            async for event in stream:
                frame = event.frame
                # frame.data is `array.array('h', ...)` of int16 samples
                self.captured.pcm_chunks.append(bytes(frame.data))
                if self.captured.started_at is None:
                    self.captured.started_at = self._loop.time()
                self.captured.last_frame_at = self._loop.time()
        except asyncio.CancelledError:
            logger.debug("audio consumer cancelled")
        except Exception as err:  # pragma: no cover — defensive
            logger.exception("audio consumer crashed: %s", err)

    async def stop(self) -> CapturedAudio:
        if self._stream is not None:
            try:
                await self._stream.aclose()
            except Exception:  # pragma: no cover
                pass
        if self._consumer_task is not None:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except (asyncio.CancelledError, Exception):
                pass
        logger.info(
            "captured %.2fs of user audio (%d chunks)",
            self.captured.duration_seconds,
            len(self.captured.pcm_chunks),
        )
        return self.captured
