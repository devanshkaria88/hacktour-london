<div align="center">

# Olando

**A voice-first longitudinal mental-health check-in for people on NHS waiting lists.**

Talk for sixty seconds a day. Olando listens for what your voice says about
how you are doing, tracks it against your own personal baseline, and quietly
escalates to a clinician when your trajectory genuinely diverges.

[![NestJS](https://img.shields.io/badge/backend-NestJS_11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/frontend-Next.js_15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Postgres](https://img.shields.io/badge/db-Postgres_15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![LiveKit](https://img.shields.io/badge/realtime-LiveKit_Cloud-1FD5B9?logo=livekit&logoColor=white)](https://livekit.io/)
[![Speechmatics](https://img.shields.io/badge/STT-Speechmatics_Medical-7E22CE)](https://www.speechmatics.com/)
[![Thymia](https://img.shields.io/badge/biomarkers-Thymia_Sentinel-1F2937)](https://thymia.ai/)

Built for **HackTour London 2026** — Medical track.

</div>

---

## Table of contents

- [Why Olando exists](#why-olando-exists)
- [What Olando does, in one minute](#what-olando-does-in-one-minute)
- [Architecture](#architecture)
- [How we use Speechmatics](#how-we-use-speechmatics)
- [How we use Thymia](#how-we-use-thymia)
- [How divergence detection works](#how-divergence-detection-works)
- [Run Olando locally](#run-olando-locally)
- [Repository layout](#repository-layout)
- [Graceful degradation](#graceful-degradation)
- [Hackathon context](#hackathon-context)
- [Roadmap beyond the hack](#roadmap-beyond-the-hack)
- [License](#license)

---

## Why Olando exists

NHS talking-therapy waitlists run six to eighteen months. Roughly 1.8 million
people sit on them at any given moment in England alone. People deteriorate
silently in that gap and only surface when they are already in crisis.

Existing self-report tools (PHQ-9, GAD-7) are accurate but require effort and
honesty on a bad day — exactly when both are scarcest. The current path to
re-prioritisation depends on the patient self-advocating to their GP, which
demands the very mental bandwidth they no longer have.

A 60-second voice sample is something most people will actually do. Inside
that minute live a dozen acoustic and prosodic biomarkers — speech rate,
pause distribution, pitch variability, voice quality — that correlate with
depression and anxiety severity. Olando pairs those with two or three
conversational PHQ/GAD items the agent weaves into the chat, builds a personal
baseline over the first two weeks, and flags worsening before the person
notices it themselves.

> Olando never tells the user a number. It tells the on-call clinician there
> is one, with the evidence attached.

The economic case is brutal in the right direction. A voice check-in costs
fractions of a penny in compute. A single night of a crisis admission costs
£500–£3,000. Catching one deterioration early is roughly a 10,000× return on
the cost of running the tool.

---

## What Olando does, in one minute

1. **You talk.** A calm, conversational voice agent greets you and asks one
   reflective prompt for the day ("How did you sleep, and how does that show
   up today?"). It listens, reflects, weaves in two or three PHQ-9/GAD-7
   items naturally, and lets you go when you're done.
2. **Olando listens twice.** A real-time Speechmatics transcript drives the
   conversation; a second medical-domain Speechmatics pass produces the
   high-fidelity clinical transcript that ends up on a clinician's desk.
3. **Thymia Sentinel scores your voice.** Twenty Apollo and Helios biomarker
   dimensions — anhedonia, sleep, anxiety, restlessness, fatigue — each on a
   0–1 scale.
4. **We track you against you.** Olando builds a personal baseline from your
   first two weeks of check-ins and watches the seven-day rolling average of
   your PHQ-9 and GAD-7 composites for meaningful divergence.
5. **We hand off when it matters.** When divergence crosses two standard
   deviations above your baseline, Olando generates a one-page, GP-ready
   triage packet PDF — chart, dimensions that moved, plain-language
   interpretation, and a clear "this is a screening signal, not a diagnosis"
   disclaimer.

---

## Architecture

```
                      ┌─────────────────────────────────────┐
                      │             Browser (Next.js)        │
                      │  /record · /trajectory · /triage     │
                      │  LiveKit React SDK · RTK Query       │
                      └─────────┬──────────────┬─────────────┘
                                │ WebRTC       │ HTTPS (cookie auth)
                                ▼              ▼
            ┌──────────────────────────┐   ┌──────────────────────────┐
            │   LiveKit Cloud (SFU)    │   │   NestJS API (port 3001) │
            │   - Room dispatch        │   │   - Auth (Argon2 + JWT)  │
            │   - Inference: GPT-4o    │◄──┤   - Token issuer         │
            │     mini + Cartesia TTS  │   │   - Divergence detector  │
            └──────────┬───────────────┘   │   - Triage PDF (PDFKit)  │
                       │ agent dispatch    │   - Questionnaire engine │
                       ▼                   └────────────┬─────────────┘
            ┌──────────────────────────┐                │
            │  voice-agent (Python)    │                │
            │  livekit-agents          │                ▼
            │  + Speechmatics STT      │   ┌──────────────────────────┐
            │  + Silero VAD            │   │      Postgres 15         │
            │  + multilingual turn     │   │  users · checkins        │
            │    detection             │   │  biomarker_readings      │
            │                          │   │  questionnaire_responses │
            │  Captures user audio,    │   │  triage_events           │
            │  runs PHQ/GAD weave,     │   │  baselines               │
            │  then on shutdown ↓      │   └──────────────────────────┘
            └──────────┬───────────────┘                ▲
                       │ POST /analyze (WAV)            │ POST /from-session
                       ▼                                │ (X-Agent-Secret)
            ┌──────────────────────────┐                │
            │  voice-service (FastAPI) │────────────────┘
            │  - ffmpeg → 16kHz PCM    │
            │  - Speechmatics Batch    │
            │    (medical domain)      │
            │  - Thymia Sentinel WS    │
            │    (Apollo + Helios)     │
            └──────────────────────────┘
```

Five processes, three deliberate boundaries:

| Service | Stack | Responsibility |
|---|---|---|
| **`frontend/`** | Next.js 15 · React 19 · Tailwind 4 · shadcn/ui · Recharts · LiveKit React SDK | The whole user-facing surface. Auth pages, the live conversation room, the trajectory dashboard, triage event detail. |
| **`backend/`** | NestJS 11 · TypeORM 0.3 · Postgres 15 · PDFKit | System of record. Owns auth, schema, divergence math, questionnaire selection/scoring, triage PDF generation, LiveKit token minting. |
| **`voice-agent/`** | Python 3.11 · `livekit-agents` · Speechmatics STT plugin · Silero VAD | The conversation. One LiveKit worker per active room. Holds the persona, asks PHQ/GAD items, captures user audio for offline analysis, posts results to backend on shutdown. |
| **`voice-service/`** | Python 3.11 · FastAPI · Speechmatics Batch SDK · Thymia Sentinel WS | Stateless analysis sidecar. Takes a WAV, returns `{transcript, biomarkers}`. Designed to be horizontally scalable and to fail gracefully back to a deterministic mock. |
| **LiveKit Cloud** | Managed | WebRTC SFU + Inference (GPT-4o-mini for the LLM, Cartesia Sonic-3 for TTS). We bring our own STT and VAD. |

---

## How we use Speechmatics

Speechmatics shows up in **two distinct places** in the pipeline. They serve
different purposes and use different SDKs.

### 1. Live STT inside the LiveKit agent (real-time)

The voice agent uses the official **`livekit-plugins-speechmatics`** plugin
to stream the user's audio frames directly from the LiveKit room into
Speechmatics' real-time API. The partial and final transcripts are what the
LLM sees turn-by-turn — that's how the agent can reflect on what the user
just said and ask a meaningful follow-up.

We pair it with **Silero VAD** and the multilingual turn-detection model so
the agent knows when the user has actually finished speaking versus paused
mid-thought, which is what makes the conversation feel non-robotic.

```python
# voice-agent/agent.py
from livekit.plugins import speechmatics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

session = AgentSession(
    stt=speechmatics.STT(),
    vad=silero.VAD.load(),
    turn_detection=MultilingualModel(),
    llm="openai/gpt-4o-mini",          # via LiveKit Inference
    tts="cartesia/sonic-3",            # via LiveKit Inference
)
```

### 2. Batch transcription for the audit trail

Separately, the agent records the entire user-side audio to a WAV and on
session shutdown ships it to `voice-service`. The sidecar runs a second
Speechmatics pass — this time the **Batch SDK** with the **`medical`
domain** and the **`enhanced`** operating point — to produce a high-fidelity
clinical-quality transcript that lives in the `checkins.transcript` column
and gets quoted on the triage PDF.

```python
# voice-service/app/analysis.py
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
```

Why two passes? The realtime stream is optimised for low latency so the
agent can react. The batch pass is optimised for accuracy — domain-tuned,
medical vocabulary aware — because that transcript is what a clinician will
read months later when triaging the alert.

---

## How we use Thymia

Thymia's **Sentinel** SDK is a streaming voice-biomarker engine. We plug it
into `voice-service` because biomarker extraction needs the full clean WAV,
not the chunked frames the LiveKit agent sees, and because keeping it out of
the agent process means biomarker latency never blocks the conversation.

We enable two of Thymia's biomarker bundles:

| Bundle | Dimensions we persist | Maps to |
|---|---|---|
| **Apollo (depression)** | anhedonia, low mood, sleep issues, low energy, appetite, worthlessness, concentration, psychomotor | PHQ-9 items 1–8 |
| **Apollo (anxiety)** | nervousness, uncontrollable worry, excessive worry, trouble relaxing, restlessness, irritability, dread | GAD-7 items 1–7 |
| **Helios (wellness)** | distress, stress, burnout, fatigue, low self-esteem | Broader wellness signal |

That's 20 individual scores per check-in, each on a 0..1 scale, which we
flatten into the `biomarker_readings` table. From them we derive two
**composites** — `phq9_composite` (mean of the 8 Apollo-depression
dimensions) and `gad7_composite` (mean of the 7 Apollo-anxiety dimensions) —
and those composites are what the divergence detector watches.

The integration uses Sentinel's **`passthrough` policy** so we get the raw
scores rather than letting the policy reasoner make a clinical
recommendation — that decision deliberately stays on our side, where we
can show the math to the clinician.

```python
# voice-service/app/analysis.py
from thymia_sentinel import SentinelClient

sentinel = SentinelClient(
    user_label="olando-checkin",
    policies=["passthrough"],
    biomarkers=["helios", "apollo"],
    sample_rate=16_000,
)
await sentinel.connect()
# stream the WAV in 32 KB chunks…
await sentinel.send_user_transcript(transcript, is_final=True)
# Sentinel emits a single POLICY_RESULT with all 20 dimensions populated.
```

If Thymia is unreachable or returns insufficient speech, the sidecar
gracefully falls back to a deterministic elevated mock (~0.62 across all
dimensions) so the demo divergence detector still fires against the seeded
~0.36 baseline — the warning is logged so it's never silent.

---

## How divergence detection works

For every new check-in Olando:

1. Appends the new biomarker reading to the user's full history.
2. Computes the **personal baseline** from the first 14 check-ins (mean and
   standard deviation per composite).
3. Computes the **seven-day rolling average** across the most recent seven
   check-ins.
4. If the rolling average exceeds `baseline_mean + 2 × baseline_stddev` for
   either PHQ-9 or GAD-7, persists a `triage_events` row whose
   `trigger_reason` explains the threshold crossing in plain English and
   generates a downloadable PDF packet.

Drops below baseline are deliberately **not** flagged — the goal is to
escalate worsening, not improvement.

In parallel, the questionnaire engine maintains a rolling 14-day PHQ-8 and
GAD-7 total from items the agent asked, scored against the published 0–3
severity scale and bucketed into the standard severity bands (none /
mild / moderate / moderately-severe / severe). Coverage below 80% of the
instrument is reported but not bucketed, in line with the published
clinical guidance. PHQ-9 item 9 (self-harm ideation) is excluded from the
rotation; the agent has dedicated safety logic for that topic.

---

## Run Olando locally

You'll need Docker Desktop, Node 20+, Python 3.11+, ffmpeg
(`brew install ffmpeg`), and a LiveKit Cloud project (free tier is fine).

```bash
# 1. Postgres
docker compose up -d postgres

# 2. Voice service (Speechmatics + Thymia sidecar)
cd voice-service
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # SPEECHMATICS_API_KEY, THYMIA_API_KEY
uvicorn app.main:app --port 8000

# 3. Backend
cd ../backend
npm install
cp .env.example .env       # DB url, JWT secret, LIVEKIT_*, VOICE_AGENT_SHARED_SECRET
npm run migration:run
npm run start:dev

# 4. Voice agent (LiveKit worker)
cd ../voice-agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # LIVEKIT_*, SPEECHMATICS_API_KEY, BACKEND_URL, shared secret
python agent.py dev        # registers with LiveKit Cloud and waits for dispatch

# 5. Frontend
cd ../frontend
npm install
npm run dev                # http://localhost:3000

# 6. (optional) seed 21 days of plausible history for a dev account
cd ../backend
npm run seed:dev
```

Then sign up at `http://localhost:3000/signup`, hit **Record today's
check-in**, and have a conversation. After you disconnect you'll watch the
finalisation UI step through capture → transcribe → biomarkers → trajectory
update in real time, and the new point will land on the chart.

---

## Repository layout

```
.
├── backend/         NestJS 11 + TypeORM 0.3 + Postgres 15.
│                    Auth, schema, divergence detector, questionnaire engine,
│                    triage PDF, LiveKit token issuer.
│
├── voice-agent/     Python 3.11 LiveKit worker.
│                    Persona, conversation flow, PHQ/GAD weave, audio capture,
│                    on-shutdown finalisation.
│
├── voice-service/   Python 3.11 FastAPI sidecar.
│                    Speechmatics (medical, batch) + Thymia Sentinel (Apollo,
│                    Helios) wrapped behind a single POST /analyze.
│
├── frontend/        Next.js 15 App Router.
│                    Auth, /record (LiveKit room), /trajectory (charts +
│                    biomarker tabs + self-report), /triage/[id] (event detail
│                    + PDF download).
│
├── docker-compose.yml   Postgres 15 (named volume).
└── PRD.md, backend.md, frontend.md, context.md   Design notes.
```

Project-level conventions live under `.cursor/rules/`.

---

## Graceful degradation

Olando is designed to always produce a result during a demo:

- **No `SPEECHMATICS_API_KEY`** → transcript is `null`. Biomarkers continue
  to flow because the realtime STT stream isn't required for the batch pass.
- **No `THYMIA_API_KEY`** → biomarkers fall back to a deterministic mock
  around 0.62 so the divergence detector reliably fires against the seeded
  baseline of ~0.36.
- **`voice-service` unreachable** → backend records the check-in with null
  biomarkers and skips divergence detection for that point.
- **LiveKit unreachable** → the legacy `POST /api/v1/checkins` tap-to-record
  path still works as a fallback.

Every fallback is logged so it's never silent.

---

## Hackathon context

Olando is being built for **HackTour London 2026**, in the **Medical** track.
The judging rubric is scored out of one hundred:

| Criterion | Weight |
|---|---|
| Innovation and Creativity | 25% |
| Technical Execution | 25% |
| Voice AI Integration | 25% |
| Impact and Practicality | 15% |
| Presentation and Demo | 10% |

Three quarters of the score rewards cleverness, working code, and depth of
voice technology integration. Olando uses both sponsor SDKs — Speechmatics
for clinical-grade transcription via the medical domain model, and Thymia
Sentinel for voice biomarkers via the Apollo and Helios bundles — for the
features they were actually built for, not bolted on. The integration is
load-bearing: pull either out and the product stops working.

The pitch is three minutes:

1. **Problem (30s)** — 1.8M people on NHS mental-health waiting lists.
   Three to eighteen months between referral and first appointment. Zero
   structured signal in between. A crisis admission costs £500–£3,000 a
   night. A voice check-in costs five pence.
2. **Product (90s)** — Open the app, hit record, have a one-minute
   conversation with the agent. Watch the transcript and biomarkers populate
   live, watch the trajectory chart update, watch a divergence event fire
   against the pre-seeded baseline.
3. **Packet (60s)** — Click "Download triage packet". Walk through the
   one-page PDF: trajectory chart, the dimensions that moved, plain-language
   interpretation, and the explicit screening-not-diagnosis disclaimer.

Two minutes held in reserve for questions.

---

## Roadmap beyond the hack

- **Multilingual** — Speechmatics handles 55 languages; Olando's pipeline is
  language-agnostic everywhere except the daily prompt copy. Adding language
  picker + translated prompts is a one-day job.
- **Equity dashboard** — Aggregate, anonymous baseline patterns across
  synthetic demographic groups so commissioners can see whether the tool
  serves under-represented groups disproportionately well.
- **Clinician portal** — A read-only triage queue for GP practices that opt
  in, sorted by divergence severity, with patient consent gates.
- **Trust artefact** — A plain-language page explaining exactly how Olando
  works, what it can and cannot claim, and how patient data is handled.
  Linked from every screen.
- **Crisis-line escalation** — When the agent's safety logic fires
  (Samaritans 116 123 today), persist the event so the patient's GP sees it
  on their next visit.

---

## License

MIT (see `LICENSE` if/when added). Built in 24 hours; please don't put it in
front of an actual patient without a clinical-safety review.
