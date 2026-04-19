# Olando — Backend Instructions

This document lives in the `backend/` subdirectory and is read by the AI agent building the NestJS API. Before touching any code, read PRD.md and context.md at the repository root, and read the backend rules at `.cursor/rules/backend.mdc`. Nothing in this document overrides the PRD. Everything in this document describes how to implement what the PRD asks for.

## What you are building

The backend is a NestJS application in TypeScript. It exposes a REST API to the frontend. It owns the PostgreSQL database via TypeORM. It is the only service that talks to the Python voice analysis sidecar. It is the only service that generates the triage packet PDF. It runs on Render alongside the Python sidecar and a managed PostgreSQL instance.

The backend has three responsibilities. First, accept voice check-in uploads from the frontend, forward them to the Python sidecar for analysis, and persist the results. Second, serve trajectory data to the frontend so the line chart can render. Third, detect divergence events and generate triage packets on demand.

## Conventions you must follow

The backend follows the GreenTask backend conventions exactly. Before writing any code, open `/Users/devansh/Greentask/software/backend-core/.windsurf/rules/project-overview.md` and `/Users/devansh/Greentask/software/backend-core/.windsurf/rules/implementation-rules.md` and treat them as binding. The tech stack is identical: NestJS, PostgreSQL 15, TypeORM 0.3, class-validator DTOs, Swagger decorators on every endpoint. The entity base columns are identical: UUID primary keys, createdAt and updatedAt timestamps, and a soft-delete isDeleted boolean on every table. Migrations are always generated through the TypeORM CLI scripts in package.json — never by hand, never with synchronize enabled.

The one deviation from GreenTask conventions you are allowed to make: skip the multi-role auth system entirely. This is a hackathon build. There is exactly one demo user, seeded at boot time with a fixed UUID. All endpoints operate against that user. Do not build Firebase auth, partner JWT, admin JWT, or any guards. Do not build rate limiting. These are valuable in production but would cost hours this weekend does not have.

## Project structure

The backend lives at the repository root under `backend/`. Inside that directory, follow the NestJS module structure from the GreenTask reference. Create modules for `checkins`, `biomarkers`, `trajectory`, and `triage`. Create a `voice-service` module that wraps the HTTP client calling the Python sidecar. Create a `common` folder for shared enums and interfaces. Create a `database` folder containing the TypeORM data source and migrations. Create a `scripts` folder for the seeding script that populates the demo user's history.

## Data model

Four tables. Use UUID primary keys, include the standard createdAt, updatedAt, isDeleted columns on every table. Name the tables in snake_case, name the entity classes in PascalCase ending in `Entity` is optional — follow whichever convention is used in the GreenTask reference. Foreign keys should carry the semantic name of the referenced entity in camelCase followed by `Id`, such as `userId` or `checkinId`.

The `users` table holds a single row for the demo user, seeded at boot. The columns are the standard base columns plus a `name` column of type varchar with a length of 255.

The `checkins` table represents a single voice recording event. Columns are the standard base columns, a `userId` foreign key into users, a `recordedAt` timestamptz, a `transcript` text column nullable, an `audioDurationSec` integer, an `audioStoragePath` varchar 500 nullable to hold the path to the saved audio file on disk or object storage, and a `selfRating` integer nullable for an optional one-to-ten how-are-you-feeling field.

The `biomarker_readings` table represents the output of a single analysis run. One row per checkin. Columns are the standard base columns, a `checkinId` foreign key into checkins with a unique constraint since one checkin produces one reading, and then a wide set of float columns for each biomarker dimension. Include all eight Apollo depression dimensions (anhedonia, lowMood, sleepIssues, lowEnergy, appetite, worthlessness, concentration, psychomotor), all seven Apollo anxiety dimensions (nervousness, uncontrollableWorry, excessiveWorry, troubleRelaxing, restlessness, irritability, dread), all five Helios wellness dimensions (distress, stress, burnout, fatigue, lowSelfEsteem), and two composite score columns `phq9Composite` and `gad7Composite` which the backend computes and stores at insert time as the mean of the relevant dimensions. All biomarker columns are floats on a zero-to-one scale, nullable because a given analysis run may fail to return a specific dimension.

The `triage_events` table logs every time the divergence detector fires. Columns are the standard base columns, a `userId` foreign key, a `triggeredAt` timestamptz, a `triggerReason` text column explaining in human-readable terms what crossed threshold, a `triggeringCheckinId` foreign key into checkins pointing at the check-in that triggered the event, a `baselineMean` float, a `baselineStddev` float, and an `observedValue` float. This table is the source of truth for the triage packet PDF — the PDF generator reads from it.

## API surface

All routes live under `/api/v1`. Use the NestJS global prefix. Every endpoint gets full Swagger decoration including ApiTags, ApiOperation with a clear summary, and ApiResponse for every possible status code. Every request body uses a DTO class with class-validator decorators and ApiProperty decorators so the OpenAPI spec is complete. Every response uses a DTO class annotated with ApiProperty so the frontend type generator picks it up.

The endpoints to implement are as follows.

POST `/api/v1/checkins` accepts a multipart upload with an audio file field and an optional selfRating integer. The backend stores the audio to disk under `/tmp/audio/{checkinId}.wav`, creates a checkin row, forwards the audio to the Python voice service, receives transcript and biomarker scores back, creates a biomarker_readings row, runs the divergence detector against the user's full history, creates a triage_events row if divergence is detected, and returns a response DTO containing the checkin id, the transcript, the biomarker reading, and a boolean indicating whether a divergence event was created.

GET `/api/v1/trajectory` returns the user's full checkin history ordered by recordedAt ascending. Each item in the response array contains the checkin id, the recordedAt timestamp, the phq9Composite, the gad7Composite, and a boolean indicating whether this checkin triggered a divergence event. The response wraps this array in a data envelope matching the GreenTask pagination pattern.

GET `/api/v1/baseline` returns the user's computed baseline — the mean and standard deviation of the phq9Composite and gad7Composite over the user's first fourteen days of check-ins, or null if the user has fewer than seven check-ins. The response also includes a boolean `isEstablished` indicating whether enough data exists for divergence detection to run.

GET `/api/v1/triage-events` returns all triage events for the user ordered by triggeredAt descending. Each event carries all the columns from the triage_events table plus a nested trajectory summary (the same data as the trajectory endpoint returns) so the PDF generator can render the chart without making a second call.

GET `/api/v1/triage-events/:id/packet` generates and returns a PDF for the specified triage event. Use PDFKit or Puppeteer — Puppeteer is easier if you want to render HTML to PDF, PDFKit is faster and has no Chromium dependency. Prefer PDFKit for this build. The PDF must be one page, must contain the trajectory chart rendered as an SVG or PNG, the divergence event details, the specific biomarker dimensions that crossed threshold, a plain-language interpretation, and the required disclaimer about the tool being a screening signal rather than a diagnosis.

## Divergence detection algorithm

Implement this as a pure function in a `DivergenceDetectorService`. The function takes the user's full ordered history of biomarker_readings and returns either null or a DivergenceEvent object.

Require at least seven check-ins in the history before the baseline is considered established. Compute the baseline mean and standard deviation from the first fourteen check-ins in the user's history — not from a rolling window. Once a baseline is established, it is fixed. Compute the current observed value as the mean of the phq9Composite over the last seven check-ins (a rolling seven-day average). Do the same for the gad7Composite separately. If either composite's observed value is more than two standard deviations above the baseline mean, return a DivergenceEvent. The `triggerReason` field of the event must be a human-readable string such as "Seven-day rolling average of PHQ-9 composite (0.72) has exceeded the personal baseline (mean 0.48, stddev 0.09) by more than two standard deviations."

Be strict about the direction. A drop in biomarker scores relative to baseline means the patient is improving — do not flag that. Only flag increases.

## Voice service integration

Create a `VoiceServiceClient` service in the `voice-service` module. It wraps HTTP calls to the Python sidecar whose URL comes from the `VOICE_SERVICE_URL` environment variable. The client exposes a single method `analyzeAudio(filePath: string): Promise<AnalysisResult>` where `AnalysisResult` contains the transcript string and a biomarkers object matching the shape of the `biomarker_readings` table row.

Post the audio file to the sidecar as multipart form data. Parse the JSON response. Validate it with a class-validator DTO so that a malformed response from the sidecar surfaces as a clean error. Wrap the whole call in a try-catch — if the sidecar fails, return a degraded result with the transcript filled and the biomarkers set to null, and log the error. The frontend can still show the transcript even if biomarkers fail.

## OpenAPI specification — this is a priority task

The frontend generates its entire API client from the backend's OpenAPI spec. If the spec is incomplete, the frontend breaks. Treat the spec as a first-class deliverable, not an afterthought.

Every controller method must carry ApiTags, ApiOperation, ApiResponse for the success status, and ApiResponse for every error status it can realistically produce. Every DTO class — both request and response — must have ApiProperty decorators on every field, including the type, description, and example value where useful. Enums used in DTOs must be decorated with ApiProperty({ enum: EnumName }) so they appear as enums in the spec rather than as loose strings. Date fields must use ApiProperty({ type: String, format: 'date-time' }) so the generator produces correct Date types on the frontend. Nested DTOs must use ApiProperty({ type: () => OtherDto }) so the generator follows the reference. Array fields must use ApiProperty({ type: [OtherDto] }).

Expose the OpenAPI JSON at `/api/docs-json` via the DocumentBuilder setup in main.ts, matching the pattern used in the GreenTask reference backend so that the frontend's `generate-schema.sh` script works without modification. Also expose the Swagger UI at `/api/docs` for human inspection during development.

After implementing every endpoint, run the backend locally, hit the `/api/docs-json` URL, and manually inspect the resulting spec. Check that every endpoint appears, every request body has a schema, every response has a schema, every field has a type. This spec is the contract the frontend builds against — do not ship it broken.

## Seeding for the demo

Create a script at `backend/scripts/seed-demo-data.ts` that when run via ts-node will wipe and repopulate the demo user's data. The script should insert a single user with a fixed UUID, then insert fourteen days of check-ins with recordedAt timestamps spanning the past two weeks and biomarker readings whose composite scores sit within a narrow range — a mean around 0.35 to 0.45, with small natural variance — to establish a stable baseline. Commit the exact biomarker values used so the behaviour is reproducible. The demo presenter will run this script before going on stage.

The actual on-stage check-in must land with composite scores high enough to trigger the divergence detector. You do not need to engineer this — the presenter will talk about a deliberately difficult week and the biomarkers will respond. But the seeded baseline must be low enough that this divergence is clean and visible.

## Environment variables

The backend reads the following from environment. `DATABASE_URL` as a standard Postgres connection string. `VOICE_SERVICE_URL` pointing at the Python sidecar — locally this will be `http://localhost:8000`, on Render it will be the internal service URL. `PORT` for the HTTP port, defaulting to 3000. `NODE_ENV` for environment gating. No secrets beyond the database URL — the Python service handles the Speechmatics and thymia API keys, not the NestJS service.

## Deployment

Deploy to Render. The Dockerfile matches the GreenTask pattern: multi-stage build, install dependencies, run build, copy dist, run the node process. The Render service type is a web service pointing at the built image. Migrations run as a one-off job on Render after each deploy, using the TypeORM CLI migration:run script.

## Build order — do these in exactly this order

First, scaffold the NestJS application with `nest new backend` and wire up TypeORM with the database config. Get the bootstrap working and verify the app starts cleanly against a local Postgres.

Second, create the entities and generate the initial migration. Run the migration against the local database. Verify the tables exist. Commit the migration file.

Third, create the seeding script and run it. Verify the demo user and fourteen days of check-ins appear in the database.

Fourth, implement the trajectory and baseline endpoints. These read from the database and return simple DTOs. Wire up Swagger decorators fully. Test by hitting the endpoints manually via curl and by opening Swagger UI.

Fifth, implement the VoiceServiceClient as a stub that returns hardcoded transcript and biomarkers for any audio file. Wire the checkins endpoint end to end using the stub. Confirm the full flow works: upload audio, get a row in checkins, get a row in biomarker_readings, get a sensible response.

Sixth, swap the stub for a real HTTP call to the Python sidecar once the sidecar is running. Before this step you must coordinate with whoever is building the sidecar to agree on the exact request and response shapes.

Seventh, implement the divergence detector as a pure service with unit tests on a handful of fixed input arrays. Wire it into the checkins endpoint post-save. Verify that submitting a check-in with high enough scores against the seeded baseline creates a triage_events row.

Eighth, implement the triage packet PDF endpoint. Test it by hitting the URL in a browser and confirming a one-page PDF downloads with all required elements.

Ninth, verify the OpenAPI spec is complete by hitting `/api/docs-json` and scanning the output for missing types or schemas. Fix anything that is not exhaustively annotated.

Tenth, deploy to Render, run migrations, seed the demo data on the deployed database, and smoke test every endpoint against the deployed URL. Hand off the deployed URL to the frontend builder.

## What a shippable backend looks like

At the end of Saturday, the backend is a running NestJS service on Render with a seeded demo user, complete Swagger docs at `/api/docs`, a working end-to-end check-in flow that produces real biomarker data through the Python sidecar, a functional divergence detector, and a PDF generator that returns a credible-looking one-page triage packet. The frontend builder can run `scripts/generate-schema.sh` against the deployed backend URL and get clean, typed RTK Query hooks for every endpoint.
