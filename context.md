# Olando — Context Document

This document exists for humans. It gives you, the reader, everything you need to understand what Olando is, why it exists, and how it fits into the hackathon it is being built for. If you are an AI agent, read PRD.md instead — that document is written for you and is more directive.

## The short version

Olando is a voice check-in tool for people waiting months to see an NHS mental health specialist. You record sixty seconds of voice once a day. The system transcribes what you said and analyses how you said it, extracting clinically validated voice biomarkers. It tracks you against your own baseline. When something changes meaningfully, it produces a one-page document you can hand to your GP to ask for a second look at your waiting list position.

We are building it for **HackTour London 2026**, in the Medical track. The hackathon's medical sponsors — Thymia and Speechmatics — provide the SDKs that form the technical backbone of what we are building.

## The problem we are addressing

Mental health waiting lists in England are catastrophic. There are around 1.8 million people on them. The average wait between being referred by a GP and being seen by a specialist is three to eighteen months. During that wait, the patient's condition can deteriorate significantly — or even fatally — with nobody checking in.

The only way to get re-prioritised today is to go back to your GP, explain that you are getting worse, and have them write to the trust to request a bump up the list. This requires the patient to be organised, articulate, and self-advocating during the months they are least able to be any of those things. The people who advocate loudest get seen soonest. This is the opposite of clinical need driving access.

Meanwhile, the NHS has no continuous signal about anyone on the list. The next data point after the initial referral is the first appointment — potentially six months later — by which time the clinician is reconstructing from memory.

## Why voice is the right sensor

Voice biomarkers are a legitimate and growing field of clinical research. Thymia — one of the medical-track sponsors of HackTour London 2026 — has a published, peer-reviewed body of work showing that voice features correlate meaningfully with depression and anxiety scores on validated clinical instruments like the PHQ-9 and the GAD-7.

This does not mean voice can diagnose. It cannot. What voice can do is give a cheap, passive, longitudinal signal — something that tracks against your own baseline over time and can detect meaningful divergence. That is exactly the signal the NHS is currently missing during the waiting period. A voice check-in costs fractions of a penny. A crisis admission costs hundreds to thousands of pounds per night. The ROI of catching one deterioration early is enormous.

## How Olando works, in plain language

A person on the waiting list downloads the web app or bookmarks the URL. Once a day, a simple prompt appears: "How was your week so far?" or similar. They tap record, speak for up to a minute, and tap stop.

Behind the scenes, the audio is sent to two analysers in parallel. Speechmatics transcribes the audio using their medical-domain speech-to-text model, which is tuned for clinical vocabulary. Thymia's Sentinel pipeline runs biomarker extraction, producing scores for each of the PHQ-9 depression dimensions (things like anhedonia, low mood, low energy, worthlessness, concentration difficulty) and each of the GAD-7 anxiety dimensions (things like nervousness, uncontrollable worry, restlessness, irritability). It also produces wellness scores from the Helios suite: distress, stress, burnout, fatigue, low self-esteem.

All of this is stored in a PostgreSQL database. The user is taken back to a dashboard that shows them their own trajectory over time, plotted as two composite scores — one for depression dimensions, one for anxiety.

After about two weeks of data, the system can establish a baseline for that specific user. From that point onwards, every new check-in is compared against the baseline. If the seven-day rolling average moves more than two standard deviations from the baseline, the system flags a divergence event.

When a divergence event fires, the user gets the option to generate a triage packet. This is a one-page PDF containing the trajectory chart, the specific event, a plain-language interpretation, and a clear disclaimer that the tool is a screening signal rather than a diagnosis. The user can hand this packet to their GP, who can then make their own clinical judgement about whether to escalate the patient on the waiting list.

## What this is not

This is not a diagnostic tool. It does not tell anyone they have depression or anxiety. It tells them that their voice has changed compared to their own historical baseline.

This is not a tool that argues with clinicians. The packet is designed to be a conversation starter with a GP, not a claim against one. Every surface of the product reinforces this.

This is not a replacement for mental health care. It is a signal for a healthcare system that currently collects no signal during a multi-month gap.

This is not a mood journal. We are deliberately building this differently from mood-tracking apps. The product is the trajectory and the divergence detection — the recording is just the input, and the trend is what the clinician cares about.

## The hackathon

We are building Olando for **HackTour London 2026**, entering the Medical track. The event's medical sponsors — Thymia and Speechmatics — provide the SDKs that form the backbone of the build (Thymia for voice biomarker extraction, Speechmatics for medical-domain transcription). Judging is scored across Innovation and Creativity, Technical Execution, Voice AI Integration, Impact and Practicality, and Presentation and Demo.

The team is two people: me and Vivek. The build budget is the weekend of the hackathon — long enough to ship an end-to-end demo, not long enough to over-engineer.

## The architecture at a glance

The frontend is a Next.js 15 application using the App Router, with TypeScript throughout. State and API calls are handled with Redux Toolkit and RTK Query. The UI is built entirely from shadcn/ui components. Charts use Recharts. The application is deployed to Vercel.

The backend is a NestJS application in TypeScript, using TypeORM against a PostgreSQL database. It exposes a REST API documented via OpenAPI at the `/docs-json` endpoint. The frontend generates its TypeScript types and API client hooks from this OpenAPI spec automatically via a script.

A thin Python service sits alongside the NestJS backend. This service exists because the thymia Sentinel SDK and the Speechmatics SDK are both Python-first and their JavaScript equivalents are less mature. The Python service is called from the NestJS backend, not from the frontend — the frontend only ever talks to NestJS. The Python service is deployed to Render.

All infrastructure runs on Render for consistency with our existing patterns, except the frontend which runs on Vercel.

## The demo plan

The pitch is three minutes long, leaving two minutes of the five-minute slot reserved for questions. Beat one is the problem: the NHS waiting list crisis and the cost-per-admission argument. Beat two is the product: live recording, live transcription, live biomarkers, trajectory chart updating on screen. Beat three is the packet: divergence event fires, PDF generates, we walk through it.

For the demo to be credible, the demo user account is pre-seeded with fourteen days of synthetic prior check-ins so that the live check-in on stage actually has a baseline to diverge from. This is not a shortcut — it represents what a real user's account looks like after two weeks of daily use, which is when the product starts being useful.

## The honest risks

There are three risks worth flagging, and the architecture of the product addresses each.

The first is overclaiming what voice biomarkers can do. The product addresses this by tracking users against their own personal baseline rather than against a population norm, and by framing every output as a screening signal rather than a diagnosis.

The second is false positives triggering unnecessary GP visits. The product addresses this by requiring a seven-day rolling average to move two standard deviations from a fourteen-day baseline — a high bar that reliably filters single-day noise like a bad night's sleep.

The third is competing with existing mood-tracking apps and being perceived as incremental. The product addresses this by framing itself as NHS triage infrastructure rather than as a consumer wellness product. The economic argument — fifty pence in compute versus hundreds of pounds in admission costs — is the differentiator.

## File map of this repository

The repository contains a `backend/` directory for the NestJS API, a `frontend/` directory for the Next.js app, and a `voice-service/` directory for the Python sidecar. At the root you will find this context document, the PRD, per-subdirectory documents in `backend.md` and `frontend.md` telling the AI agent what to build in each, a `cursor_prompt.md` that bootstraps the Cursor agent, and rules files in `.cursor/rules/` controlling how the agent behaves as it codes.

## If you are picking this up cold

Read the PRD first. Then read this document. Then open `backend.md` or `frontend.md` depending on which part you are working on. Then open the cursor prompt and feed it to the agent. The rules files will do the rest.
