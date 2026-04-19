# Olando — Frontend Instructions

This document lives in the `frontend/` subdirectory and is read by the AI agent building the Next.js application. Before touching any code, read PRD.md and context.md at the repository root, and read the frontend rules at `.cursor/rules/frontend.mdc`. Nothing in this document overrides the PRD. Everything in this document describes how to implement the frontend the PRD asks for.

## What you are building

The frontend is a Next.js 15 application with the App Router and TypeScript in strict mode. It is the only surface the user sees during the demo. It must be polished enough that a judge watching the demo has no friction, no layout glitches, no blank states, and no moments of confusion about what the product does. It will be deployed to Vercel.

The frontend has four surfaces. A recording screen where the user records a sixty-second check-in. A trajectory screen where the user sees their biomarker history and current status. A triage event screen that confirms a divergence has been detected and offers the packet download. A minimal landing page that frames the product for first-time visitors.

The frontend never talks to the Python voice service directly. All data comes from the NestJS backend. All mutations go through RTK Query hooks generated from the backend's OpenAPI spec.

## Conventions you must follow

The frontend follows the GreenTask admin dashboard conventions exactly. Before writing any code, open `/Users/devansh/Greentask/software/greentask-admin/.windsurf/rules/project-implementation.md` and treat it as binding. The stack is identical: Next.js 15 App Router, TypeScript strict mode, shadcn/ui components only, Tailwind CSS 4, Redux Toolkit with RTK Query, React Hook Form with Zod, Recharts, Framer Motion, Lucide icons, date-fns, Sonner for toasts, next-themes. The route group pattern from GreenTask is followed exactly — route groups in parentheses separate layouts without affecting the URL.

The prohibitions from the GreenTask rules are absolute. Never use TanStack Table. Never use raw HTML elements when a shadcn component exists. Never use Material UI, Ant Design, or any non-shadcn component library. Never create custom table logic. Every clickable element carries the Tailwind class `cursor-pointer`.

The one deviation from GreenTask: skip the authentication layer. There is no login page. Every screen assumes the demo user. Do not build AuthInitializer, do not build login forms, do not check tokens. The RTK Query base URL points directly at the backend without any Authorization header.

## Project structure

Mirror the GreenTask admin structure. The `src/app` directory holds the App Router pages. Use a single route group `(main)` for all authenticated-style pages so that the landing page at the root can use a different layout. The `src/components` directory contains a `ui/` folder for shadcn components and topical subfolders like `recording/`, `trajectory/`, `triage/`, and `layout/`. The `src/managers` directory holds `apiManager.ts` for the RTK Query API and any other slices needed. The `src/store` directory holds `store.ts`. The `src/interfaces` directory holds TypeScript interfaces manually written when you need something beyond what the generated schema provides. The `src/lib` directory holds utilities and Zod schemas. The `src/providers` directory holds the Providers component that wraps Redux, theme, and toast.

## UI and design direction

The UI must feel calm, clinical, and respectful. This is a product for people who are unwell and for clinicians who are busy. No neon, no excessive gradients, no illustrations of cartoon brains. The aesthetic is closer to a calm pharmacy than to a startup landing page.

Use the `ui-ux-pro-max` skill for all UI and UX work. The skill will guide colour choices, spacing, typography, and component composition. When in doubt, defer to the skill's suggestions rather than improvising. The skill must be consulted before building the recording screen, the trajectory screen, and the landing page — these three surfaces are what the judges see, and each one must feel considered.

Colour palette principles: use a neutral base with a single muted accent. Avoid red for anything except the divergence event state. Avoid green for anything except the stable state. Amber is for the trending state. These three colours map directly to the three trajectory status states described in the PRD.

Typography: use one typeface throughout. Use shadcn's default typography classes. Headings carry real weight and spacing — a dashboard subheading is not a centred hero.

Motion: use Framer Motion for the recording button's pulsing animation during capture, for the trajectory chart's reveal on mount, and for the triage event card's entrance when a divergence fires. Do not animate anything else. Motion is a garnish, not the main course.

## Screen-by-screen specification

### Landing page (`/`)

A single-column page, centred, with the product name "Olando" in a large heading, a one-sentence tagline explaining what it does, and a single primary button labelled "Begin daily check-in" that navigates to `/record`. Below the fold, a short three-line description of how the tool works and a link to a small "How this works" section. No login, no sign-up, no marketing copy. A judge landing here should immediately understand the product.

### Recording screen (`/record`)

A single-screen focused experience. At the top, a small greeting with the demo user's name and today's date. Below that, the prompt for the day, rendered in a large serif-like heading size. Below the prompt, a single large circular record button. Below the button, a visual audio waveform that comes alive during recording, and a timer counting up to sixty seconds. After sixty seconds or a manual stop, the button transitions to an "Analysing your check-in" state with a loading indicator. After analysis completes, the screen transitions to the trajectory view, and a toast from Sonner confirms the check-in was saved.

The recording logic uses the browser's MediaRecorder API to capture audio. The recording is uploaded to the backend's `POST /api/v1/checkins` endpoint as multipart form data. Use the generated RTK Query mutation hook for this call. While the mutation is pending, disable the record button and show the analysing state.

### Trajectory screen (`/trajectory`)

The primary dashboard. At the top, a large heading reading something like "Your trajectory". Below that, a Recharts line chart showing two lines: the phq9Composite over time and the gad7Composite over time. The x-axis is time. The y-axis is the composite score from zero to one. Points that triggered a divergence event are marked with a red dot. The chart uses shadcn's default chart colour tokens.

Below the chart sits a status panel. The panel's colour and content depend on the current state. If the baseline is not yet established (fewer than seven check-ins), the panel says "Keep checking in daily. We'll establish your baseline after a week of data" in a neutral colour. If the baseline is established and no divergence is active, the panel says "Your trajectory is stable" in green. If a divergence has been detected, the panel turns amber or red and explains what moved — this is where the divergence event card appears.

Below the status panel, a secondary "Record today's check-in" button links back to `/record`. Above the chart, a small note states when the user's last check-in happened.

All data for this screen comes from a single RTK Query call: the generated hook for `GET /api/v1/trajectory`. Render skeleton loaders while the query is in flight.

### Triage event screen (`/triage/[id]`)

Reached by tapping the divergence event card on the trajectory screen. A focused page explaining the specific divergence event that was detected: what dimensions moved, what the observed value was, what the baseline was. Below that, a "Download triage packet" button that calls `GET /api/v1/triage-events/:id/packet` and triggers a browser download of the returned PDF. Below the button, a secondary heading "What happens next" with two or three sentences explaining in plain language what to do with the packet — bring it to your GP, ask about your position on the waiting list, the packet is a starting point for a conversation.

### Layout and navigation

The root layout wires up Providers (Redux, theme, Sonner). The `(main)` route group layout adds a slim top header containing the Olando wordmark on the left and the demo user's name on the right. No sidebar. No mobile nav. No breadcrumbs. The entire experience is three screens deep and does not need heavy navigation.

## State management

Use Redux Toolkit with RTK Query. Create a single API slice at `src/managers/apiManager.ts` following the GreenTask pattern. The API slice's `baseQuery` points at the backend URL from `NEXT_PUBLIC_API_BASE_URL`. No auth token is prepared in the headers — skip the entire Authorization header setup.

The API slice's endpoints are generated from the OpenAPI spec (see the next section). Do not hand-write endpoint definitions. If the generated endpoints need to be augmented with tag invalidation for optimistic updates, extend them in a small wrapper module rather than editing the generated file.

Beyond the API slice, you need exactly one non-API slice: a small UI slice for the recording state (idle, recording, analysing, done). Do not over-engineer the state layer. No auth slice is needed.

## OpenAPI code generation — this is a priority task

The frontend generates its TypeScript types and RTK Query endpoints directly from the backend's OpenAPI spec. This is non-negotiable. Hand-writing DTO interfaces on the frontend creates drift. Drift kills demos.

Copy the `generate-schema.sh` script from the GreenTask admin at `/Users/devansh/Greentask/software/greentask-admin/scripts/generate-schema.sh` as a starting point. Adapt it for Olando: the script must fetch the backend's `/api/docs-json` endpoint using the URL from `NEXT_PUBLIC_API_BASE_URL` in `.env`, pass it through `openapi-typescript` to generate a TypeScript schema file, and then pass the same spec through `@rtk-query/codegen-openapi` to generate RTK Query endpoint definitions.

The generated schema file lives at `src/schema.d.ts`. The generated RTK Query endpoints live at `src/managers/generated-api.ts`. The human-written `apiManager.ts` injects the generated endpoints into the base API slice, using RTK Query's `enhanceEndpoints` to add tag invalidation and cache behaviour.

Add a `rtk-query-openapi-codegen.config.ts` file at the project root that configures the codegen: the schema file input, the output file, the tag-to-endpoint mapping, and the hooks generation flag set to true so the codegen produces usable React hooks.

Add npm scripts to package.json: `generate:schema` that runs the shell script, `generate:api` that runs the RTK Query codegen, and `generate` that runs both in sequence. Run `npm run generate` whenever the backend API changes. Commit the generated files so that the frontend can be built without running the backend.

If you run `npm run generate` and the output is missing endpoints or has `any` types where specific types should appear, do not patch the generated files by hand. The problem is in the backend's OpenAPI spec — go back and fix the ApiProperty decorators there, regenerate, and come back.

## Environment variables

The frontend reads `NEXT_PUBLIC_API_BASE_URL` which points at the NestJS backend URL. Locally this is `http://localhost:3000`. On Vercel this is the deployed Render backend URL. Also reads `NEXT_PUBLIC_APP_NAME` which defaults to "Olando".

## Build order — do these in exactly this order

First, scaffold the Next.js app with `npx create-next-app@latest frontend --typescript --tailwind --app --eslint`. Install shadcn with `npx shadcn@latest init`. Install Redux Toolkit, RTK Query, react-redux, openapi-typescript, @rtk-query/codegen-openapi, Recharts, framer-motion, lucide-react, sonner, date-fns, react-hook-form, @hookform/resolvers, and zod.

Second, set up the Providers component and wire it into the root layout. Create the Redux store. Create the empty apiManager with an empty API slice. Verify the app still builds.

Third, create the `generate-schema.sh` script and the RTK Query codegen config. Run the backend locally, hit `npm run generate`, and confirm that `src/schema.d.ts` and `src/managers/generated-api.ts` are created and contain the expected endpoints. If the backend is not ready, use a mock `/docs-json` response to unblock yourself, but come back and regenerate against the real backend the moment it is running.

Fourth, install the shadcn components you will need: button, card, skeleton, toast, form, input, dialog. Install them one at a time with `npx shadcn@latest add <name>`. Do not install every shadcn component up front — only install what the four screens actually use.

Fifth, build the landing page. Keep it minimal. This is the lowest-risk screen and a good warm-up for the design direction.

Sixth, build the recording screen. Start with the MediaRecorder integration working in isolation, recording audio to an in-memory Blob. Once that works, wire it to the upload mutation. Use the generated RTK Query hook. Handle the loading and error states explicitly.

Seventh, build the trajectory screen. Fetch data with the generated trajectory hook. Render the Recharts chart. Render the status panel with the three colour states. Render the triage event card if present.

Eighth, build the triage event screen and wire up the PDF download. The PDF download is a simple anchor tag with a `download` attribute pointing at the packet endpoint, or a fetch-blob-and-trigger-download pattern if auth headers were needed (they are not, for this build).

Ninth, consult the ui-ux-pro-max skill on each screen in turn and apply its design suggestions. This is not a cosmetic pass — it is a craft pass. Typography, spacing, colour, motion. The judging rubric has ten percent on Presentation and Demo, and polish is the cheap way to win those ten points.

Tenth, deploy to Vercel. Confirm that the deployed frontend successfully talks to the deployed backend. Smoke test the full end-to-end flow from the deployed URL.

## What a shippable frontend looks like

At the end of Saturday, the frontend is a deployed Vercel application with a clean landing page, a working recording flow that captures audio and uploads it to the backend, a trajectory screen that renders the user's real biomarker history from the database, and a triage event screen that downloads a real PDF from the backend. The RTK Query integration is fully generated from the backend OpenAPI spec with zero hand-written endpoint definitions. Every clickable element carries cursor-pointer. Every loading state has a skeleton. Every error has a toast. A judge watching the demo should not see a single console error, a single layout jump, or a single moment of confusion about what to click next.
