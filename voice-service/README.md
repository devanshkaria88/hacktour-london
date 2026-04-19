# Olando — voice analysis sidecar

A small FastAPI service that the NestJS backend calls to transcribe an audio
recording (Speechmatics medical-domain) and extract voice biomarkers (Thymia
Sentinel passthrough policy, Apollo + Helios). It is **not** exposed to the
browser.

## Quick start

```bash
cd voice-service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# fill in SPEECHMATICS_API_KEY and THYMIA_API_KEY (optional — degrades gracefully)

uvicorn app.main:app --port 8000 --reload
```

Then, from the backend, set `VOICE_SERVICE_URL=http://localhost:8000` and submit
a check-in via `POST /api/v1/checkins`.

## Endpoint

`POST /analyze`  •  multipart/form-data, field `audio`

```json
{
  "transcript": "It has been a tough week...",
  "biomarkers": {
    "anhedonia": 0.61, "lowMood": 0.65, ...
  }
}
```

If keys are missing or a provider fails, the service returns a deterministic
mock biomarker set with elevated values so the demo still produces a divergence
event end-to-end.

## Decoding

`ffmpeg` is required on `PATH` — the service decodes any incoming audio
container (webm, mp3, wav, m4a, ogg) to 16 kHz mono PCM s16le before
streaming to Sentinel.
