# Olando — Cursor Agent Bootstrap Prompt

Paste the contents of this file into Cursor's agent chat as the first message. This prompt gives the agent everything it needs to start building. It references other files rather than duplicating their content, so the agent should open and read them as instructed.

---

You are building Olando, a voice-first longitudinal mental health check-in tool for people on NHS waiting lists. The product records sixty seconds of voice once a day, analyses the audio for voice biomarkers aligned with the PHQ-9 and GAD-7 clinical scales, tracks the user against their own baseline over time, and generates a one-page PDF triage packet when biomarkers diverge meaningfully from baseline.

This build has a hard deadline. It is being demoed at **HackTour London 2026** in the AI 4 Good track. Every hour matters. Work in focused passes, ship working code, cut scope aggressively when you have to.

## Step one — read these files before doing anything else

Open and read, in this order:

First, `PRD.md` at the repository root. This is the north star. It defines what is being built and why. Every decision you make must trace back to something in this document.

Second, `context.md` at the repository root. This is human-readable background. It will fill in gaps the PRD does not cover and give you the vibe of the product.

Third, `backend.md` inside the `backend/` directory. This tells you what to build in the backend specifically, in what order, with what endpoints, against what data model.

Fourth, `frontend.md` inside the `frontend/` directory. This tells you what to build in the frontend specifically, with what screens, what state patterns, what code generation.

Fifth, `.cursor/rules/backend.mdc` and `.cursor/rules/frontend.mdc`. These are Cursor rules that will auto-apply when you edit files in the relevant directories. Cursor loads them automatically but you should understand them up front.

Sixth, the GreenTask backend rules at `/Users/devansh/Greentask/software/backend-core/.windsurf/rules/project-overview.md`, `.../implementation-rules.md`, and `.../git-rules.md`. These are the conventions for how I build backends. Olando follows them.

Seventh, the GreenTask admin rules at `/Users/devansh/Greentask/software/greentask-admin/.windsurf/rules/project-implementation.md`. These are the conventions for how I build Next.js frontends. Olando follows them.

Do not start coding until you have read all of these files. Acknowledge each one as you read it so I know where you are.

## Step two — use the ui-ux-pro-max skill for all UI work

When building any frontend screen — the landing page, the recording screen, the trajectory screen, the triage event screen — consult the `ui-ux-pro-max` skill before writing the JSX. The skill encodes design sensibilities around typography, spacing, colour, motion, and component composition. Let the skill drive your choices on these axes rather than improvising. The judges are evaluating presentation and demo polish at ten percent of the rubric — this is the cheap way to win those points.

If you are tempted to add a gradient, a cartoon illustration, or neon accents, stop and ask the skill instead. The product is meant to feel calm and clinical, not like a startup landing page.

## Step three — the overall build order

The build happens in two parallel streams: one person working on the backend, one on the frontend. Coordinate whenever the API contract is defined or changes, but otherwise work independently. Both streams run against a locally-running Postgres spun up with Docker Compose from the repository root.

### Backend stream

Follow the build order in `backend.md`. In summary: scaffold NestJS, wire TypeORM, create entities, run migrations, seed demo data, implement trajectory and baseline endpoints, stub the voice service client, implement the checkins endpoint end to end with the stub, swap the stub for real Python sidecar calls, implement the divergence detector, implement the PDF packet generator, verify the OpenAPI spec is complete, deploy to Render.

The OpenAPI spec at `/api/docs-json` is not optional. It is the contract the frontend builds against. If the spec is incomplete, the frontend's code generator produces broken types and the integration fails. Every DTO needs exhaustive `ApiProperty` decoration. After every endpoint you implement, hit `/api/docs-json` and verify the spec reflects it correctly.

### Frontend stream

Follow the build order in `frontend.md`. In summary: scaffold Next.js with Tailwind and shadcn, install the required dependencies, set up Redux Toolkit with RTK Query and the Providers component, write the code generation script and config, run the generator against the backend, install shadcn components as needed, build the landing page, build the recording screen with MediaRecorder integration, build the trajectory screen with Recharts, build the triage event screen with PDF download, polish each screen through the ui-ux-pro-max skill, deploy to Vercel.

The code generation pipeline is not optional. Never hand-write a DTO interface for a backend endpoint. Never use raw fetch in a component. All types come from the backend spec through `openapi-typescript` and `@rtk-query/codegen-openapi`.

### Python voice service stream

A thin Python service runs alongside the NestJS backend. It wraps the thymia Sentinel SDK and the Speechmatics medical-domain SDK. It exposes one endpoint, `POST /analyze`, that takes an audio file upload and returns JSON with a `transcript` string and a `biomarkers` object matching the shape of the `biomarker_readings` table columns. Use FastAPI. Under fifty lines. Deploy to Render as a second service.

The Thymia hackathon repository contains working example code that uses both SDKs together. Copy the pattern from the `examples/02_combined_pipeline` example as the starting point. The hackathon API keys are in your local environment as `SPEECHMATICS_API_KEY` and `THYMIA_API_KEY`.

## Step four — non-negotiable rules

These rules override everything except the PRD.

Never build authentication. There is one demo user, hardcoded. Skip login, skip JWT, skip auth guards, skip AuthInitializer. Every minute spent on auth is a minute not spent on the demo.

Never build a mobile app. Web only. Mobile demos fail on stage every time.

Never build a multi-agent architecture. This is a single-pipeline product with two sponsor integrations running in parallel. Multi-agent would be decorative, not structural.

Never invent new libraries. The stack is locked. NestJS plus TypeORM plus Postgres on the backend. Next.js plus shadcn plus Redux Toolkit plus RTK Query on the frontend. FastAPI on the voice service. Do not reach for anything outside these.

Never use `synchronize: true` in TypeORM. Every schema change is a migration.

Never set `any` to silence TypeScript. If you cannot type something, wrap it in a narrow interface and move on.

Never hand-write DTO interfaces on the frontend. Generate them.

Never ship a screen without cursor-pointer on every clickable element.

Never ship a screen without a skeleton loader while data is in flight.

Never ship a mutation without a Sonner toast on success and error.

Never ship a pitch without the three required disclaimers: voice biomarkers are a screening signal, not a diagnosis; a divergence event is a suggestion to the clinician, not an assertion against the clinician; the patient owns their own data.

## Step five — the demo script drives everything

The pitch is three minutes. Beat one is the problem — NHS waiting list crisis, cost-per-admission argument. Beat two is the live recording: open the app, hit record, speak for a minute about a difficult week, watch biomarkers populate, watch the trajectory chart update, watch the divergence event fire because the pre-seeded baseline is stable enough for today's reading to cross threshold. Beat three is the packet: click generate, open the PDF, walk through the chart and the plain-language interpretation.

Every feature you build must advance one of these three beats. If it doesn't, cut it.

## Step six — coordination between backend and frontend

The API contract is defined by the DTOs in the backend. The frontend generates its types from those DTOs. Any change to a DTO on the backend is a breaking change for the frontend until the generator is rerun.

When the backend is in a state where it can serve `/api/docs-json`, the frontend should run `npm run generate` to regenerate types and API hooks. Commit the generated files. When a new endpoint lands on the backend, the frontend regenerates.

Do not hand-coordinate the API shape in free text. Let the OpenAPI spec be the single source of truth.

## Step seven — time budget and checkpoints

If you are building backend: get the trajectory and baseline endpoints working against a seeded database within two hours of starting. Get the checkins endpoint with a stubbed voice service working within three hours. Get real voice integration working within five hours. Get the PDF generator working within six hours. Deploy to Render within seven hours. Anything unshipped after eight hours from start is cut.

If you are building frontend: get the Next.js app scaffolded and Providers wired within thirty minutes. Get the RTK Query code generation working against the backend within ninety minutes. Get the landing page and recording screen working within three hours. Get the trajectory screen working within four hours. Get the triage event screen working within five hours. Polish pass on every screen within six hours. Deploy to Vercel within seven hours. Anything unshipped after eight hours from start is cut.

When you hit a blocker that costs more than thirty minutes, stop and tell me. Do not burn two hours debugging a library choice when the alternative is cutting a feature.

## Step eight — what I expect from you right now

Acknowledge that you have read this prompt. Open and read, in order, PRD.md, context.md, backend.md, frontend.md, backend.mdc, frontend.mdc, and the four GreenTask rules files. After each file, summarise in one sentence what you learned from it so I can verify you actually read it.

Then tell me which of the three streams you are picking up — backend, frontend, or voice service. Then tell me your plan for the first hour in that stream.

Then, and only then, start coding.
