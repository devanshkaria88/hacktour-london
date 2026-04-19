# Olando — Product Requirements Document

This is the north star document for the AI agent building this product. Read this end to end before writing any code. Every architectural decision, every feature cut, every library choice must trace back to something in this document. If a proposed change cannot be justified against what is written here, do not build it.

## What we are building

Olando is a voice-first longitudinal self-tracking tool for people on NHS mental health waiting lists. A person records a sixty-second voice check-in once per day, answering a simple prompt. The check-in is transcribed with a medical-grade speech model and analysed for voice biomarkers that are aligned with the PHQ-9 depression scale and the GAD-7 anxiety scale. Each reading is stored against the user's growing history and compared against their own established baseline. When the user's biomarker trajectory diverges meaningfully from that baseline, the system generates a one-page triage packet in PDF form — a clinician-facing document that a GP can review to support a request for re-prioritisation on the waiting list.

The product is not a diagnostic tool. It does not replace clinical judgement. It is triage infrastructure: a low-cost, passive, longitudinal signal for a healthcare system that currently has no way to detect deterioration in the months between a referral and a first appointment.

## Why this exists

There are approximately 1.8 million people on NHS mental health waiting lists in England. The average wait between a GP referral and a first specialist appointment sits between three and eighteen months. During that wait, there is zero structured data collected about whether the patient is improving, holding steady, or deteriorating. Re-prioritisation currently depends on the patient self-advocating to their GP — a process that itself requires the mental bandwidth the patient often does not have while they are unwell.

A voice check-in costs around five pence in compute. A single night of a crisis admission costs between five hundred and three thousand pounds. Catching one deterioration early and preventing one admission represents a return on investment of roughly ten thousand times the cost of the tool. The economic case for a voice-based triage signal is overwhelming and must be front and centre in every pitch and every line of product copy.

## Who this is for

There are two users who matter, and their needs are different.

The person recording the check-ins is a user on an NHS waiting list. They may be anxious, depressed, fatigued, or otherwise low-functioning. The recording experience must be forgiving, must require minimal cognitive load, and must never make the user feel observed, judged, or pathologised. A large record button, a single prompt, and immediate positive feedback after recording — nothing more on that screen.

The reader of the triage packet is a general practitioner or a triage clinician at an NHS trust. They have minutes, not hours. They need a clear, defensible, one-page document that tells them what changed, when it changed, and why the change is worth a second look. The packet must read as a clinical adjunct, not as a claim.

## What the hackathon judges are evaluating

This product is being built for **HackTour London 2026**, in the Medical track. The judging rubric is scored out of one hundred with the following weights. Innovation and creativity is twenty-five percent. Technical execution is twenty-five percent. Voice AI integration is twenty-five percent. Impact and practicality is fifteen percent. Presentation and demo is ten percent.

Three quarters of the score rewards cleverness, working code, and depth of voice technology integration. The judges will see through wrappers around generic speech-to-text models. They want to see both medical-track sponsors used for their strongest features: Speechmatics for clinical-grade transcription with its medical domain model, and Thymia Sentinel for voice biomarkers from the Apollo and Helios dimensions. The integration must be meaningful, not bolted on.

## The core user journey

The user opens the web application. They see a single page with a large record button, a single prompt for today such as "How has your week been so far?", and nothing else above the fold. They tap the record button, speak for up to sixty seconds, and tap stop. The audio is uploaded to the server.

The server transcribes the audio using the Speechmatics medical-domain speech-to-text endpoint. The same audio, simultaneously, is streamed through the thymia Sentinel pipeline to extract biomarker scores across all the Apollo dimensions aligned with PHQ-9 and GAD-7, and all the Helios wellness dimensions covering distress, stress, burnout, fatigue, and low self-esteem. The transcript and all the biomarker readings are stored in the database against the user's growing history.

The user is returned to a screen showing their trajectory — a line chart over the past days and weeks plotting two composite scores: a depression composite (the mean of the Apollo depression dimensions) and an anxiety composite (the mean of the Apollo anxiety dimensions). Underneath the chart sits a simple status panel: "Your trajectory is stable" in green, or "Your trajectory shows an upward trend" in amber, or "Your biomarkers have diverged from your baseline" in red.

If the system has detected a significant divergence event, a card appears below the chart inviting the user to download a triage packet. The user taps download. The system generates a one-page PDF containing the trajectory chart, the specific divergence event, the biomarker dimensions that crossed threshold, a plain-language interpretation of what this means, and an explicit disclaimer clarifying that the packet is a screening signal and not a diagnosis. The user can bring this PDF to their next GP appointment.

## What counts as a divergence event

A divergence event is when the user's most recent seven-day rolling average of either the PHQ-9 composite or the GAD-7 composite score has moved by more than two standard deviations away from the user's personal fourteen-day baseline, which is computed after the user has submitted at least seven check-ins. This definition matters for three reasons. First, it is anchored to the user's own baseline, not to a population norm, which is the clinically defensible approach. Second, it uses a rolling average rather than single readings, so one bad-sleep day does not trigger a false alarm. Third, it waits for enough data to establish a baseline, which keeps the product honest about when it can and cannot speak.

## Feature scope — must ship for HackTour London 2026

The product must ship by the hackathon submission deadline with the following capabilities working end to end. A user must be able to record a sixty-second voice check-in through the browser. The recording must be transcribed using the Speechmatics medical domain model. The recording must be analysed through Thymia Sentinel to produce Apollo and Helios biomarker scores. The scores must be stored and retrieved from PostgreSQL. The user must be able to see their own trajectory on a line chart. The system must detect a divergence event and generate a one-page PDF triage packet on demand.

For the demo, the database must be pre-seeded with fourteen days of synthetic prior check-ins for a demo patient, so that when the presenter adds a live check-in on stage, the divergence detection has enough history to fire. This seeding is not a shortcut — it is a legitimate representation of what a real user's account would look like after two weeks of daily use.

## Stretch scope — extensions if time allows

If the core ships with time to spare, layer on multilingual support by exercising the Speechmatics fifty-five-language capability, an aggregate view showing anonymous baseline patterns across synthetic demographic groups to surface the equity argument, and a shareable trust artefact explaining in plain language how the system works, what it can and cannot claim, and how patient data is handled. None of this changes the core recording or analysis pipeline.

## What we are explicitly not building

We are not building authentication. For the hackathon, a single demo user is hard-coded. Adding auth burns two hours we cannot afford and adds no judge-visible value.

We are not building a mobile app. Mobile is a demo trap that takes too long to validate on stage, and the web works fine for every scenario we need to show.

We are not building a clinician dashboard. The clinician surface is the PDF itself. A separate clinician login adds a second UI surface, a second permissions model, and hours of work for a feature no judge will click through to during a seven-minute pitch.

We are not building voice cloning, real-time TTS responses, or conversational agent behaviour. The product is voice-in, silent-analysis, visual-out. Adding a talking agent is scope creep that distracts from the core insight.

We are not building multi-agent orchestration. A single analysis pipeline with two parallel sponsor integrations is the correct architecture. Multi-agent systems are structurally unnecessary here and would dilute the judging story.

## Technical commitments

The stack is frontend in Next.js 15 with App Router and TypeScript. State management on the frontend is Redux Toolkit with RTK Query. UI components are shadcn/ui only. Charts are Recharts. The backend is NestJS in TypeScript with TypeORM against PostgreSQL. A thin Python sidecar service runs the thymia Sentinel and Speechmatics SDKs because their Python SDKs are more mature than anything available in JavaScript. The sidecar is called from the NestJS backend, not from the frontend directly. All database access from TypeScript code goes through TypeORM entities and repositories. Migrations are generated with the TypeORM CLI and are committed to source control. The frontend generates its TypeScript types and RTK Query endpoints from the NestJS OpenAPI spec using a script that hits the `/docs-json` endpoint on the backend.

## Ethical perimeter — non-negotiable

Every surface of the product must reinforce three claims. First, voice biomarkers are a screening signal, not a diagnosis. Second, a divergence event is a suggestion to the clinician, not an assertion against the clinician. Third, the patient owns their own data and the packet is generated only when the patient requests it. These claims must appear on the recording screen, on the trajectory screen, and on the PDF packet itself. A judge asking "does your tool override the doctor" must hear a clean "no, and here is where the product says so" within five seconds.

## Demo script — the one that wins

The demo is three beats.

Beat one: the problem. Thirty seconds. "One point eight million people are on NHS mental health waiting lists. Average wait, three to eighteen months. During that wait, nobody is checking on them. Re-prioritisation requires the patient to self-advocate while they are unwell. A crisis admission costs between five hundred and three thousand pounds a night. A voice check-in costs five pence."

Beat two: the product. Ninety seconds. Open the web app. Hit record. Speak for sixty seconds about a difficult week. Stop. Watch the transcript render. Watch the biomarker scores populate. Show the trajectory chart updating. Point to the divergence event that just fired because the pre-seeded baseline made today's reading cross threshold.

Beat three: the packet. Sixty seconds. Click generate triage packet. The PDF opens. Walk through it: the chart, the specific dimensions that moved, the plain-language interpretation, the disclaimer. "This is what a patient brings to their GP. The GP decides. We just made the signal visible."

Total: three minutes. Two minutes held in reserve for questions.

## What every feature must justify

Before adding anything, the agent must ask three questions. Does this feature advance one of the three-minute demo beats? Does it score directly on one of the five rubric criteria? Does it survive the judge stress test "is this overclaiming what voice biomarkers can do"? If the answer to any of these is no, the feature does not ship.
