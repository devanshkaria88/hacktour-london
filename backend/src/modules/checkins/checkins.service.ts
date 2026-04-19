import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { dirname, join, extname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { CheckinEntity } from './entities/checkin.entity';
import { BiomarkerReadingEntity } from '../biomarkers/entities/biomarker-reading.entity';
import { TriageEventEntity } from '../triage/entities/triage-event.entity';
import { VoiceServiceClient } from '../voice-service/voice-service.client';
import { DivergenceDetectorService } from '../triage/divergence-detector.service';
import { TrajectoryService } from '../trajectory/trajectory.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { QuestionnaireAnswerDto } from '../questionnaire/dto/questionnaire.dto';
import {
  APOLLO_ANXIETY_DIMENSIONS,
  APOLLO_DEPRESSION_DIMENSIONS,
} from '../../common/constants';
import {
  AnalysisResultDto,
  BiomarkersDto,
} from '../voice-service/dto/analysis-result.dto';
import { CheckinResponseDto } from './dto/checkin-response.dto';
import { TriageEventDto } from '../triage/dto/triage-event.dto';

interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

interface SessionFinalisationInput {
  sessionId?: string | null;
  transcript: string | null;
  biomarkers: BiomarkersDto | null;
  audioDurationSec: number;
  recordedAt?: Date;
  questionnaireResponses?: QuestionnaireAnswerDto[];
}

const AUDIO_ROOT = process.env.AUDIO_STORAGE_ROOT
  ? process.env.AUDIO_STORAGE_ROOT
  : join(tmpdir(), 'olando-audio');

@Injectable()
export class CheckinsService {
  private readonly logger = new Logger(CheckinsService.name);

  constructor(
    @InjectRepository(CheckinEntity)
    private readonly checkinRepo: Repository<CheckinEntity>,
    @InjectRepository(BiomarkerReadingEntity)
    private readonly readingRepo: Repository<BiomarkerReadingEntity>,
    @InjectRepository(TriageEventEntity)
    private readonly triageRepo: Repository<TriageEventEntity>,
    private readonly voiceClient: VoiceServiceClient,
    private readonly divergenceDetector: DivergenceDetectorService,
    private readonly trajectoryService: TrajectoryService,
    private readonly dataSource: DataSource,
    private readonly questionnaireService: QuestionnaireService,
  ) {}

  /**
   * Legacy "tap-to-record" path: browser uploads a single audio blob, we analyse and persist.
   * Kept as a fallback when the conversational LiveKit agent isn't reachable.
   */
  async createCheckin(
    userId: string,
    file: UploadInput,
    selfRating: number | null,
  ): Promise<CheckinResponseDto> {
    const checkinId = randomUUID();
    const audioPath = await this.persistAudio(checkinId, file);

    let analysis: AnalysisResultDto = { transcript: null, biomarkers: null };
    try {
      analysis = await this.voiceClient.analyzeAudio(audioPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Voice analysis threw: ${message}`);
    }

    return this.persistAnalysis({
      userId,
      checkinId,
      audioStoragePath: audioPath,
      audioDurationSec: 0,
      transcript: analysis.transcript,
      biomarkers: analysis.biomarkers,
      selfRating,
    });
  }

  /**
   * Voice-agent path: the LiveKit worker has already captured the user's utterance,
   * uploaded it to the voice-service for biomarker analysis, and now hands us the
   * finished transcript + biomarkers + the path to the saved audio.
   */
  async createFromSession(
    userId: string,
    payload: SessionFinalisationInput & { audioStoragePath?: string | null },
  ): Promise<CheckinResponseDto> {
    const checkinId = randomUUID();
    this.logger.log(
      `[from-session] sessionId=${payload.sessionId ?? 'n/a'} transcript_chars=${
        payload.transcript?.length ?? 0
      } biomarkers=${payload.biomarkers ? 'present' : 'null'}`,
    );
    return this.persistAnalysis({
      userId,
      checkinId,
      audioStoragePath: payload.audioStoragePath ?? null,
      audioDurationSec: payload.audioDurationSec ?? 0,
      transcript: payload.transcript,
      biomarkers: payload.biomarkers,
      selfRating: null,
      recordedAt: payload.recordedAt ?? new Date(),
      questionnaireResponses: payload.questionnaireResponses,
    });
  }

  private async persistAnalysis(input: {
    userId: string;
    checkinId: string;
    audioStoragePath: string | null;
    audioDurationSec: number;
    transcript: string | null;
    biomarkers: BiomarkersDto | null;
    selfRating: number | null;
    recordedAt?: Date;
    questionnaireResponses?: QuestionnaireAnswerDto[];
  }): Promise<CheckinResponseDto> {
    const composites = this.computeComposites(input.biomarkers);
    const recordedAt = input.recordedAt ?? new Date();

    const result = await this.dataSource.transaction(async (manager) => {
      // ENFORCE "ONE CHECK-IN PER DAY, LATEST WINS".
      // If the user already has a non-deleted check-in for the same UTC
      // day, hard-delete it inside the same transaction. All dependent
      // rows (biomarker_readings, questionnaire_responses, triage_events
      // referencing the old check-in) cascade away via FK ON DELETE
      // CASCADE, so the new row starts from a clean slate.
      //
      // We use the start/end of the UTC day rather than ::date casting at
      // query time so the comparison can use the (user_id, recorded_at)
      // composite index. The DB ALSO has a partial unique index from the
      // OneCheckinPerDay migration, which would otherwise blow up the
      // INSERT below if we forgot this step — that's deliberate.
      const dayStart = new Date(
        Date.UTC(
          recordedAt.getUTCFullYear(),
          recordedAt.getUTCMonth(),
          recordedAt.getUTCDate(),
        ),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const previous = await manager
        .createQueryBuilder(CheckinEntity, 'c')
        .where('c.user_id = :userId', { userId: input.userId })
        .andWhere('c.is_deleted = false')
        .andWhere('c.recorded_at >= :dayStart', { dayStart })
        .andWhere('c.recorded_at < :dayEnd', { dayEnd })
        .getOne();
      if (previous) {
        this.logger.log(
          `[from-session] replacing existing check-in id=${previous.id} ` +
            `for user=${input.userId} on ${dayStart.toISOString().slice(0, 10)} ` +
            `(latest-wins)`,
        );
        await manager.delete(CheckinEntity, { id: previous.id });
      }

      const checkin = manager.create(CheckinEntity, {
        id: input.checkinId,
        userId: input.userId,
        recordedAt,
        transcript: input.transcript,
        audioStoragePath: input.audioStoragePath ?? '',
        audioDurationSec: Math.round(input.audioDurationSec ?? 0),
        selfRating: input.selfRating ?? null,
      });
      await manager.save(checkin);

      const reading = manager.create(BiomarkerReadingEntity, {
        checkinId: checkin.id,
        ...(input.biomarkers ?? this.emptyBiomarkers()),
        phq9Composite: composites.phq9,
        gad7Composite: composites.gad7,
      });
      await manager.save(reading);

      checkin.biomarkerReading = reading;
      return checkin;
    });

    if (input.questionnaireResponses && input.questionnaireResponses.length > 0) {
      try {
        await this.questionnaireService.recordAnswers(
          input.userId,
          result.id,
          recordedAt,
          input.questionnaireResponses,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `[from-session] failed to persist questionnaire answers: ${message}`,
        );
      }
    }

    const history = await this.loadHistory(input.userId);
    const finding = this.divergenceDetector.detect(history);

    let triageEventDto: TriageEventDto | null = null;
    if (finding) {
      const event = this.triageRepo.create({
        userId: input.userId,
        triggeredAt: new Date(),
        composite: finding.composite,
        triggerReason: finding.triggerReason,
        triggeringCheckinId: result.id,
        baselineMean: finding.baselineMean,
        baselineStddev: finding.baselineStddev,
        observedValue: finding.observedValue,
      });
      const savedEvent = await this.triageRepo.save(event);
      const trajectory = await this.trajectoryService.collectPoints(input.userId);
      triageEventDto = {
        id: savedEvent.id,
        triggeredAt: savedEvent.triggeredAt.toISOString(),
        composite: savedEvent.composite,
        triggerReason: savedEvent.triggerReason,
        triggeringCheckinId: savedEvent.triggeringCheckinId,
        baselineMean: savedEvent.baselineMean,
        baselineStddev: savedEvent.baselineStddev,
        observedValue: savedEvent.observedValue,
        trajectory,
      };
    }

    return {
      checkinId: result.id,
      recordedAt: result.recordedAt.toISOString(),
      transcript: input.transcript,
      biomarkers: input.biomarkers,
      phq9Composite: composites.phq9,
      gad7Composite: composites.gad7,
      divergenceDetected: triageEventDto !== null,
      triageEvent: triageEventDto,
    };
  }

  private async loadHistory(userId: string): Promise<CheckinEntity[]> {
    return this.checkinRepo.find({
      where: { userId, isDeleted: false },
      relations: { biomarkerReading: true },
      order: { recordedAt: 'ASC' },
    });
  }

  private async persistAudio(
    checkinId: string,
    file: UploadInput,
  ): Promise<string> {
    const ext = (extname(file.originalName) || this.guessExtension(file.mimeType) || '.bin')
      .toLowerCase()
      .slice(0, 8);
    const target = join(AUDIO_ROOT, `${checkinId}${ext}`);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, file.buffer);
    return target;
  }

  private guessExtension(mime: string): string | null {
    if (!mime) return null;
    if (mime.includes('webm')) return '.webm';
    if (mime.includes('wav')) return '.wav';
    if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
    if (mime.includes('m4a') || mime.includes('mp4')) return '.m4a';
    if (mime.includes('ogg')) return '.ogg';
    return null;
  }

  private computeComposites(
    biomarkers: BiomarkersDto | null,
  ): { phq9: number | null; gad7: number | null } {
    if (!biomarkers) return { phq9: null, gad7: null };
    const indexed = biomarkers as unknown as Record<string, number | null>;
    const collect = (keys: readonly string[]): number | null => {
      const values = keys
        .map((k) => indexed[k])
        .filter((v): v is number => typeof v === 'number');
      if (values.length === 0) return null;
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    };
    return {
      phq9: collect(APOLLO_DEPRESSION_DIMENSIONS),
      gad7: collect(APOLLO_ANXIETY_DIMENSIONS),
    };
  }

  private emptyBiomarkers(): BiomarkersDto {
    const obj: Record<string, number | null> = {};
    [
      ...APOLLO_DEPRESSION_DIMENSIONS,
      ...APOLLO_ANXIETY_DIMENSIONS,
      'distress',
      'stress',
      'burnout',
      'fatigue',
      'lowSelfEsteem',
    ].forEach((key) => (obj[key] = null));
    return obj as unknown as BiomarkersDto;
  }
}
