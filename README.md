# Second Voice

> Voice-first longitudinal mental-health check-in for people on NHS waiting
> lists. Records a 60-second voice sample once a day, extracts voice biomarkers
> aligned with PHQ-9 and GAD-7, tracks each user against their own baseline,
> and emits a one-page triage PDF when the seven-day rolling average
> meaningfully diverges from baseline.

Built for **Voice AI Hackathon London 2026** and the **Watcha Global AI
Hackathon Tour**.

## Repository layout

```
.
├── backend/         NestJS 11 + TypeORM 0.3 + Postgres 15. Owns the schema,
│                    runs divergence detection, generates the triage PDF.
├── voice-service/   Python 3.11 FastAPI sidecar. Wraps Speechmatics medical
│                    STT and Thymia Sentinel voice biomarkers.
├── frontend/        Next.js 15 App Router (to be scaffolded).
└── docker-compose.yml   Postgres 15 (named volume).
```

## Run the backend stack locally

You need: Docker Desktop, Node 20+, Python 3.11+, ffmpeg (`brew install ffmpeg`).

```bash
# 1. Postgres
docker compose up -d postgres

# 2. Voice service (Python sidecar)
cd voice-service
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add SPEECHMATICS_API_KEY / THYMIA_API_KEY (optional)
uvicorn app.main:app --port 8000

# 3. Backend (in another terminal)
cd backend
npm install
cp .env.example .env
npm run migration:run
npm run seed
npm run start:dev
```

Then:

- API:        http://localhost:3001/api/v1
- Swagger UI: http://localhost:3001/api/docs
- OpenAPI:    http://localhost:3001/api/docs-json

## End-to-end smoke test

```bash
# generate a 2-second audio file
ffmpeg -f lavfi -i "sine=frequency=440:duration=2" -ac 1 -ar 16000 -y /tmp/sample.wav

# baseline (should show isEstablished=true after seed)
curl -s http://localhost:3001/api/v1/baseline | jq

# trajectory (14 seeded points)
curl -s http://localhost:3001/api/v1/trajectory | jq '.total'

# submit a check-in (mock biomarkers ~0.6 fire divergence vs baseline ~0.36)
curl -s -X POST -F "audio=@/tmp/sample.wav;type=audio/wav" \
  -F "selfRating=5" http://localhost:3001/api/v1/checkins | jq '.divergenceDetected, .triageEvent.triggerReason'

# pull the PDF
EVT=$(curl -s http://localhost:3001/api/v1/triage-events | jq -r '.data[0].id')
curl -s -o /tmp/triage.pdf http://localhost:3001/api/v1/triage-events/$EVT/packet
open /tmp/triage.pdf
```

## How the divergence detector works

For each new check-in we:

1. Append the new biomarker reading to the user's full history.
2. Compute the personal baseline from the first 14 check-ins (mean and stddev
   for each composite).
3. Compute the seven-day rolling average across the most recent seven
   check-ins.
4. If the rolling average exceeds `baseline_mean + 2 * baseline_stddev` for
   either the PHQ-9 or GAD-7 composite, persist a `triage_events` row whose
   `trigger_reason` explains the threshold crossing in plain English.

Drops below baseline are deliberately **not** flagged — the goal is to
escalate worsening, not improvement.

## Graceful degradation

The voice service is designed so the demo always produces a result:

- No `SPEECHMATICS_API_KEY` → transcript is `null`.
- No `THYMIA_API_KEY` → biomarkers fall back to a deterministic mock around
  0.62 so the divergence detector reliably fires against the seeded baseline
  of ~0.36.

If the voice service itself is unreachable, the backend records the check-in
with null biomarkers and skips divergence detection for that point.

## Project conventions

- Backend: see `.cursor/rules/backend-rule.mdc`.
- Frontend: see `.cursor/rules/frontend-rules.mdc`.
- All design decisions: see `PRD.md`, `backend.md`, `frontend.md`,
  `context.md`.
