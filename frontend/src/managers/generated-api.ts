import { baseApi as api } from "./baseApi";
export const addTagTypes = [
  "health",
  "auth",
  "checkins",
  "triage",
  "trajectory",
  "questionnaire",
  "baseline",
  "sessions",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      healthControllerCheck: build.query<
        HealthControllerCheckApiResponse,
        HealthControllerCheckApiArg
      >({
        query: () => ({ url: `/api/v1/health` }),
        providesTags: ["health"],
      }),
      authControllerSignup: build.mutation<
        AuthControllerSignupApiResponse,
        AuthControllerSignupApiArg
      >({
        query: (queryArg) => ({
          url: `/api/v1/auth/signup`,
          method: "POST",
          body: queryArg.signupDto,
        }),
        invalidatesTags: ["auth"],
      }),
      authControllerLogin: build.mutation<
        AuthControllerLoginApiResponse,
        AuthControllerLoginApiArg
      >({
        query: (queryArg) => ({
          url: `/api/v1/auth/login`,
          method: "POST",
          body: queryArg.loginDto,
        }),
        invalidatesTags: ["auth"],
      }),
      authControllerLogout: build.mutation<
        AuthControllerLogoutApiResponse,
        AuthControllerLogoutApiArg
      >({
        query: () => ({ url: `/api/v1/auth/logout`, method: "POST" }),
        invalidatesTags: ["auth"],
      }),
      authControllerMe: build.query<
        AuthControllerMeApiResponse,
        AuthControllerMeApiArg
      >({
        query: () => ({ url: `/api/v1/auth/me` }),
        providesTags: ["auth"],
      }),
      checkinsControllerCreate: build.mutation<
        CheckinsControllerCreateApiResponse,
        CheckinsControllerCreateApiArg
      >({
        query: (queryArg) => ({
          url: `/api/v1/checkins`,
          method: "POST",
          body: queryArg.createCheckinDto,
        }),
        invalidatesTags: ["checkins"],
      }),
      checkinsControllerCreateFromSession: build.mutation<
        CheckinsControllerCreateFromSessionApiResponse,
        CheckinsControllerCreateFromSessionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/v1/checkins/from-session`,
          method: "POST",
          body: queryArg.fromSessionCheckinDto,
          headers: {
            "X-Agent-Secret": queryArg["X-Agent-Secret"],
          },
        }),
        invalidatesTags: ["checkins"],
      }),
      triageControllerList: build.query<
        TriageControllerListApiResponse,
        TriageControllerListApiArg
      >({
        query: () => ({ url: `/api/v1/triage-events` }),
        providesTags: ["triage"],
      }),
      triageControllerPacket: build.query<
        TriageControllerPacketApiResponse,
        TriageControllerPacketApiArg
      >({
        query: (queryArg) => ({
          url: `/api/v1/triage-events/${queryArg.id}/packet`,
        }),
        providesTags: ["triage"],
      }),
      trajectoryControllerGetTrajectory: build.query<
        TrajectoryControllerGetTrajectoryApiResponse,
        TrajectoryControllerGetTrajectoryApiArg
      >({
        query: () => ({ url: `/api/v1/trajectory` }),
        providesTags: ["trajectory"],
      }),
      questionnaireControllerLatest: build.query<
        QuestionnaireControllerLatestApiResponse,
        QuestionnaireControllerLatestApiArg
      >({
        query: () => ({ url: `/api/v1/questionnaire/latest` }),
        providesTags: ["questionnaire"],
      }),
      baselineControllerGetBaseline: build.query<
        BaselineControllerGetBaselineApiResponse,
        BaselineControllerGetBaselineApiArg
      >({
        query: () => ({ url: `/api/v1/baseline` }),
        providesTags: ["baseline"],
      }),
      sessionsControllerIssueToken: build.mutation<
        SessionsControllerIssueTokenApiResponse,
        SessionsControllerIssueTokenApiArg
      >({
        query: () => ({ url: `/api/v1/sessions/token`, method: "POST" }),
        invalidatesTags: ["sessions"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedApi };
export type HealthControllerCheckApiResponse =
  /** status 200 Service is running. */ HealthResponseDto;
export type HealthControllerCheckApiArg = void;
export type AuthControllerSignupApiResponse =
  /** status 201  */ AuthResponseDto;
export type AuthControllerSignupApiArg = {
  signupDto: SignupDto;
};
export type AuthControllerLoginApiResponse = /** status 200  */ AuthResponseDto;
export type AuthControllerLoginApiArg = {
  loginDto: LoginDto;
};
export type AuthControllerLogoutApiResponse = unknown;
export type AuthControllerLogoutApiArg = void;
export type AuthControllerMeApiResponse = /** status 200  */ AuthUserDto;
export type AuthControllerMeApiArg = void;
export type CheckinsControllerCreateApiResponse =
  /** status 201  */ CheckinResponseDto;
export type CheckinsControllerCreateApiArg = {
  createCheckinDto: CreateCheckinDto;
};
export type CheckinsControllerCreateFromSessionApiResponse =
  /** status 201  */ CheckinResponseDto;
export type CheckinsControllerCreateFromSessionApiArg = {
  /** Shared secret matching backend env VOICE_AGENT_SHARED_SECRET. */
  "X-Agent-Secret": string;
  fromSessionCheckinDto: FromSessionCheckinDto;
};
export type TriageControllerListApiResponse =
  /** status 200  */ TriageEventListResponseDto;
export type TriageControllerListApiArg = void;
export type TriageControllerPacketApiResponse = unknown;
export type TriageControllerPacketApiArg = {
  id: string;
};
export type TrajectoryControllerGetTrajectoryApiResponse =
  /** status 200  */ TrajectoryResponseDto;
export type TrajectoryControllerGetTrajectoryApiArg = void;
export type QuestionnaireControllerLatestApiResponse =
  /** status 200  */ QuestionnaireSummaryResponseDto;
export type QuestionnaireControllerLatestApiArg = void;
export type BaselineControllerGetBaselineApiResponse =
  /** status 200  */ BaselineResponseDto;
export type BaselineControllerGetBaselineApiArg = void;
export type SessionsControllerIssueTokenApiResponse =
  /** status 201  */ SessionTokenResponseDto;
export type SessionsControllerIssueTokenApiArg = void;
export type HealthResponseDto = {
  /** Service status indicator. */
  status: string;
  /** Server timestamp at the moment of the health check. */
  timestamp: string;
};
export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
};
export type AuthResponseDto = {
  user: AuthUserDto;
};
export type SignupDto = {
  /** Email address used as the unique login handle. */
  email: string;
  /** Plain-text password — hashed with Argon2id before storage. */
  password: string;
  /** Friendly name shown on the dashboard and to the voice agent. */
  displayName: string;
};
export type LoginDto = {
  email: string;
  password: string;
};
export type BiomarkersDto = {
  anhedonia: number | null;
  lowMood: number | null;
  sleepIssues: number | null;
  lowEnergy: number | null;
  appetite: number | null;
  worthlessness: number | null;
  concentration: number | null;
  psychomotor: number | null;
  nervousness: number | null;
  uncontrollableWorry: number | null;
  excessiveWorry: number | null;
  troubleRelaxing: number | null;
  restlessness: number | null;
  irritability: number | null;
  dread: number | null;
  distress: number | null;
  stress: number | null;
  burnout: number | null;
  fatigue: number | null;
  lowSelfEsteem: number | null;
};
export type DivergenceComposite = "phq9" | "gad7";
export type TrajectoryPointDto = {
  /** Identifier of the check-in this point represents. */
  checkinId: string;
  /** Timestamp of the check-in. */
  recordedAt: string;
  /** Mean of the eight Apollo depression dimensions for this check-in (0-1). */
  phq9Composite: number | null;
  /** Mean of the seven Apollo anxiety dimensions for this check-in (0-1). */
  gad7Composite: number | null;
  /** Whether this check-in triggered a divergence event. */
  triggeredDivergence: boolean;
  /** Per-dimension Apollo + Helios biomarker readings (0-1) for this check-in. Null if the voice service was unavailable. */
  biomarkers: BiomarkersDto | null;
};
export type TriageEventDto = {
  id: string;
  triggeredAt: string;
  /** Which composite (PHQ-9 or GAD-7) crossed threshold. */
  composite: DivergenceComposite;
  /** Human-readable explanation of the threshold crossing. */
  triggerReason: string;
  triggeringCheckinId: string;
  /** Personal baseline mean. */
  baselineMean: number;
  /** Personal baseline standard deviation. */
  baselineStddev: number;
  /** Seven-day rolling average that crossed threshold. */
  observedValue: number;
  /** Snapshot of the user trajectory at the moment of this event so the packet can render the chart without a second API call. */
  trajectory: TrajectoryPointDto[];
};
export type CheckinResponseDto = {
  /** Identifier of the new check-in. */
  checkinId: string;
  recordedAt: string;
  /** Speechmatics medical-domain transcript of the recording. */
  transcript: string | null;
  /** Apollo and Helios biomarker readings on a 0-1 scale, or null if the voice service was unavailable. */
  biomarkers: BiomarkersDto | null;
  /** PHQ-9 composite (mean of Apollo depression dimensions). */
  phq9Composite: number | null;
  /** GAD-7 composite (mean of Apollo anxiety dimensions). */
  gad7Composite: number | null;
  /** Whether this check-in tripped the divergence detector. */
  divergenceDetected: boolean;
  /** The triage event that was created for this check-in, if one was triggered. */
  triageEvent: TriageEventDto | null;
};
export type CreateCheckinDto = {
  /** Audio recording (wav, webm, mp3, m4a, ogg). Max 25 MB. */
  audio: Blob;
  /** Optional self-rating from 1 (terrible) to 10 (excellent). */
  selfRating?: number;
};
export type QuestionnaireAnswerDto = {
  questionId: string;
  /** Standard PHQ/GAD response level the LLM mapped the user reply onto: 0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day. */
  score: number;
  /** Verbatim user reply. Useful for clinician audit / re-scoring. */
  rawAnswer?: string;
};
export type FromSessionCheckinDto = {
  /** ID of the user the check-in belongs to. The agent reads this from the LiveKit room metadata that the backend baked into the session token, so it is trusted (the dispatcher only sends rooms minted by us). */
  userId: string;
  /** LiveKit room/session identifier so we can correlate logs. */
  sessionId?: string;
  /** Speechmatics transcript of the user side of the conversation. */
  transcript: string | null;
  /** Biomarker readings produced by the voice-service from the user audio. */
  biomarkers: BiomarkersDto | null;
  /** Total seconds of user audio captured during the session. */
  audioDurationSec: number;
  /** Server-side path where the agent persisted the user audio (optional). */
  audioStoragePath?: string;
  /** PHQ-9 / GAD-7 item answers the agent extracted during the session. Each one carries the standard 0-3 score plus the verbatim user reply for audit. The backend will dedupe unknown ids and out-of-range scores defensively. */
  questionnaireResponses?: QuestionnaireAnswerDto[];
};
export type TriageEventListResponseDto = {
  data: TriageEventDto[];
  total: number;
};
export type TrajectoryResponseDto = {
  /** Trajectory points ordered ascending by recordedAt. */
  data: TrajectoryPointDto[];
  /** Total number of points returned. */
  total: number;
};
export type InstrumentSummaryDto = {
  instrument: "phq9" | "gad7";
  /** Standard PHQ-9/GAD-7 scoring: SUM of item responses (0-3 each) within the rolling window. PHQ-9 here is effectively the PHQ-8 since item 9 (suicidal ideation) is covered by the agent's safety prompt rather than asked directly — the PHQ-8 uses the same severity bands as PHQ-9 (Kroenke 2009), so the number is directly comparable. GAD-7 sums all 7 items. Null if the user has answered nothing in the window. */
  total: number | null;
  /** Maximum possible total given the items we ask: 24 for PHQ-9 (PHQ-8 max — item 9 excluded), 21 for GAD-7. */
  maxScore: number;
  /** Standard severity band derived from `total`. Bands are: 0-4 minimal · 5-9 mild · 10-14 moderate · 15-19 moderately severe · 20+ severe (PHQ-9 / PHQ-8); 0-4 minimal · 5-9 mild · 10-14 moderate · 15+ severe (GAD-7). Null when `total` is null OR when `coverageValid` is false (we refuse to derive a severity band from incomplete coverage to stay honest with the published scoring rules). */
  severity:
    | ("minimal" | "mild" | "moderate" | "moderately_severe" | "severe")
    | null;
  /** Number of distinct items the user has answered inside the rolling window (deduped to most recent per item). */
  itemsAnswered: number;
  /** Number of items the agent actually rotates through. PHQ-9 = 8 (Q9 excluded), GAD-7 = 7. This is what `itemsAnswered` is judged against for coverage. */
  itemsTotal: number;
  /** Number of items in the full published instrument (PHQ-9 = 9, GAD-7 = 7). Mostly for FE labelling so users see "8 of 9 PHQ-9 items". */
  itemsPublished: number;
  /** True when ≥80% of rotatable items have been answered in the window. This is the validity rule from the original PHQ-9 manual (Spitzer/Kroenke) — below 80% coverage the score is reported but `severity` is suppressed. */
  coverageValid: boolean;
  /** Most recent answer timestamp for any item in this instrument. Null if none. */
  lastAnsweredAt: string | null;
  /** Days the rolling window covers. Standard PHQ-9/GAD-7 ask about the last 14 days. */
  windowDays: number;
};
export type QuestionnaireSummaryResponseDto = {
  phq9: InstrumentSummaryDto;
  gad7: InstrumentSummaryDto;
};
export type CompositeBaselineDto = {
  /** Mean of the composite over the baseline window. */
  mean: number;
  /** Standard deviation of the composite over the baseline window. */
  stddev: number;
};
export type BaselineResponseDto = {
  /** True once the user has at least seven check-ins so divergence detection can run. */
  isEstablished: boolean;
  /** Number of check-ins counted toward the baseline. */
  checkinCount: number;
  /** Baseline mean and stddev for the PHQ-9 composite. Null until baseline is established. */
  phq9: CompositeBaselineDto | null;
  /** Baseline mean and stddev for the GAD-7 composite. Null until baseline is established. */
  gad7: CompositeBaselineDto | null;
};
export type SessionTokenResponseDto = {
  /** LiveKit Cloud websocket URL the browser should connect to. */
  url: string;
  /** Short-lived JWT (1 hour) authorising the browser to join the room. */
  token: string;
  /** Generated room name. The agent worker dispatches into this same room. */
  roomName: string;
  /** Stable identity used for the user participant in the room. */
  identity: string;
  /** Friendly display name shown to the agent. */
  displayName: string;
  /** Agent worker name that the LiveKit dispatcher will route to. */
  agentName: string;
};
export const {
  useHealthControllerCheckQuery,
  useLazyHealthControllerCheckQuery,
  useAuthControllerSignupMutation,
  useAuthControllerLoginMutation,
  useAuthControllerLogoutMutation,
  useAuthControllerMeQuery,
  useLazyAuthControllerMeQuery,
  useCheckinsControllerCreateMutation,
  useCheckinsControllerCreateFromSessionMutation,
  useTriageControllerListQuery,
  useLazyTriageControllerListQuery,
  useTriageControllerPacketQuery,
  useLazyTriageControllerPacketQuery,
  useTrajectoryControllerGetTrajectoryQuery,
  useLazyTrajectoryControllerGetTrajectoryQuery,
  useQuestionnaireControllerLatestQuery,
  useLazyQuestionnaireControllerLatestQuery,
  useBaselineControllerGetBaselineQuery,
  useLazyBaselineControllerGetBaselineQuery,
  useSessionsControllerIssueTokenMutation,
} = injectedRtkApi;
