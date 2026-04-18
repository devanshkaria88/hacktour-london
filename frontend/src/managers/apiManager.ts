import { baseApi } from './baseApi';
import { generatedApi } from './generated-api';

/**
 * Re-export the generated endpoints with explicit tag wiring.
 *
 * The generator produces tag types from controller names ("checkins",
 * "trajectory", etc). The PRD specifies our cache should be keyed by domain
 * concepts (Trajectory, Baseline, TriageEvents, Checkin), with a new check-in
 * invalidating the trajectory, baseline, and triage event lists so the
 * dashboard refreshes automatically after a recording.
 */
const enhancedApi = generatedApi.enhanceEndpoints({
  addTagTypes: [
    'Trajectory',
    'Baseline',
    'TriageEvents',
    'Checkin',
    'Questionnaire',
  ],
  endpoints: {
    trajectoryControllerGetTrajectory: { providesTags: ['Trajectory'] },
    baselineControllerGetBaseline: { providesTags: ['Baseline'] },
    triageControllerList: { providesTags: ['TriageEvents'] },
    triageControllerPacket: { providesTags: ['TriageEvents'] },
    questionnaireControllerLatest: { providesTags: ['Questionnaire'] },
    checkinsControllerCreate: {
      invalidatesTags: [
        'Trajectory',
        'Baseline',
        'TriageEvents',
        'Checkin',
        'Questionnaire',
      ],
    },
    checkinsControllerCreateFromSession: {
      invalidatesTags: [
        'Trajectory',
        'Baseline',
        'TriageEvents',
        'Checkin',
        'Questionnaire',
      ],
    },
  },
});

export { baseApi, enhancedApi };

export {
  useHealthControllerCheckQuery as useHealthQuery,
  useTrajectoryControllerGetTrajectoryQuery as useGetTrajectoryQuery,
  useLazyTrajectoryControllerGetTrajectoryQuery as useLazyGetTrajectoryQuery,
  useBaselineControllerGetBaselineQuery as useGetBaselineQuery,
  useTriageControllerListQuery as useListTriageEventsQuery,
  useLazyTriageControllerPacketQuery as useLazyTriagePacketQuery,
  useCheckinsControllerCreateMutation as useCreateCheckinMutation,
  useSessionsControllerIssueTokenMutation as useIssueSessionTokenMutation,
  useQuestionnaireControllerLatestQuery as useGetQuestionnaireLatestQuery,
} from './generated-api';

export type {
  TrajectoryResponseDto,
  TrajectoryPointDto,
  BaselineResponseDto,
  CompositeBaselineDto,
  TriageEventDto,
  TriageEventListResponseDto,
  CheckinResponseDto,
  CreateCheckinDto,
  BiomarkersDto,
  DivergenceComposite,
  SessionTokenResponseDto,
  FromSessionCheckinDto,
  QuestionnaireSummaryResponseDto,
  InstrumentSummaryDto,
} from './generated-api';
