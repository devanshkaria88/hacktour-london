# Olando — voice agent worker

Conversational voice check-in built on [LiveKit Agents](https://docs.livekit.io/agents/), Speechmatics STT, and LiveKit Inference (LLM + TTS). Captures the user's audio in parallel and posts it to the Python `voice-service` for biomarker analysis at session end.

## How it fits

```
Browser (@livekit/components-react)
   ⇅ WebRTC
LiveKit Cloud (SFU + agent dispatcher + Inference for LLM/TTS)
   ⇅
voice-agent/  (this folder — registers as `olando-checkin`)
   ├─ Speechmatics STT for in-conversation captions
   ├─ LiveKit Inference LLM (e.g. openai/gpt-4o-mini)
   ├─ LiveKit Inference TTS (e.g. cartesia/sonic-3)
   ├─ Silero VAD + multilingual turn detector
   └─ on session end:
       ├─ POST audio bytes  → voice-service /analyze   (Speechmatics + Sentinel)
       └─ POST {transcript, biomarkers, audioDurationSec, sessionId}
                            → backend /api/v1/checkins/from-session
```

## Quickstart

```bash
cd voice-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python agent.py download-files   # one-time: VAD + turn-detector models

# Fill in .env (LIVEKIT_URL / KEY / SECRET come from cloud.livekit.io)
cp .env.example .env  # already provisioned in this repo

python agent.py dev              # registers with LiveKit Cloud + waits for jobs
```

When the backend mints a token via `POST /api/v1/sessions/token`, LiveKit Cloud dispatches this worker into the resulting room. The user joins from the browser, the agent greets them, asks the daily prompt, listens, and on disconnect calls the voice-service + backend to persist the check-in.

## Files

- `agent.py` — the entrypoint: defines the empathic check-in `Agent`, the `AgentSession` wiring (Speechmatics + Inference + Silero), and the session-end finalisation.
- `audio_capture.py` — subscribes to the user's audio track and buffers raw PCM to a WAV at 16 kHz mono.
- `finalise.py` — `httpx`-based helpers for POSTing the captured WAV to `voice-service/analyze` and the resulting `{transcript, biomarkers}` to `backend/api/v1/checkins/from-session`.

## Environment

See `.env.example` for the full list. Notable variables:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — same values as `backend/.env`.
- `LIVEKIT_AGENT_NAME` — must match the backend's value so dispatch routes correctly.
- `SPEECHMATICS_API_KEY` — same value as `voice-service/.env`.
- `VOICE_AGENT_SHARED_SECRET` — must match `backend/.env`. The backend's `AgentSecretGuard` enforces it on `POST /checkins/from-session`.
- `AGENT_LLM_MODEL` / `AGENT_TTS_MODEL` — LiveKit Inference descriptors. Defaults to `openai/gpt-4o-mini` + `cartesia/sonic-3`.

## Notes

- The agent imposes a **240-second safety timeout** on the session — judges have short attention spans.
- If the user mentions self-harm, the agent gives the Samaritans number (116 123) and ends the call.
- Captured audio is also written to `/tmp/olando-agent/<roomName>.wav` for debugging.
