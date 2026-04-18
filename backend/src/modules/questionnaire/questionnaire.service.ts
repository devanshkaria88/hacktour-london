import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { QuestionnaireResponseEntity } from './entities/questionnaire-response.entity';
import {
  ALL_ITEMS,
  GAD7_ITEMS,
  ITEMS_BY_ID,
  PHQ9_ITEMS,
  ROTATABLE_ITEMS,
  QuestionnaireItem,
  isValidCoverage,
  maxScoreForInstrument,
  severityForGad7,
  severityForPhq9,
  sumScores,
} from './questionnaire.constants';
import {
  InstrumentSummaryDto,
  QuestionPromptDto,
  QuestionnaireAnswerDto,
  QuestionnaireSummaryResponseDto,
} from './dto/questionnaire.dto';

const QUESTIONS_PER_SESSION = 4;
const ROLLING_WINDOW_DAYS = 14;

interface InstrumentDef {
  key: 'phq9' | 'gad7';
  /**
   * The full published instrument (used for FE display labels). PHQ-9 is 9
   * items even though we only rotate 8 — the safety item is "covered" by the
   * agent's safety prompt rather than asked directly.
   */
  publishedItems: readonly QuestionnaireItem[];
  /**
   * The items we actually rotate through (Q9 excluded for PHQ-9). This is
   * what coverage / max-score / validity are computed against, since it's
   * the only thing the user can realistically answer in-product.
   */
  rotatableItems: readonly QuestionnaireItem[];
  severity: (total: number) => InstrumentSummaryDto['severity'];
}

const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    key: 'phq9',
    publishedItems: PHQ9_ITEMS,
    rotatableItems: PHQ9_ITEMS.filter((i) => !i.rotationExcluded),
    severity: severityForPhq9,
  },
  {
    key: 'gad7',
    publishedItems: GAD7_ITEMS,
    rotatableItems: GAD7_ITEMS,
    severity: severityForGad7,
  },
];

@Injectable()
export class QuestionnaireService {
  private readonly logger = new Logger(QuestionnaireService.name);

  constructor(
    @InjectRepository(QuestionnaireResponseEntity)
    private readonly responseRepo: Repository<QuestionnaireResponseEntity>,
  ) {}

  /**
   * Pick the next batch of questions for a check-in.
   *
   * Strategy: prefer items the user hasn't been asked recently. We sort by
   * `lastAskedAt ASC` (nulls first), then enforce a soft instrument balance
   * (~50/50 PHQ-9 / GAD-7 across a session) so coverage builds evenly across
   * both screens. Item phq9.9 (suicidal ideation) is never in the rotation
   * pool — that's handled by the agent's safety prompt instead.
   */
  async pickQuestionsForUser(userId: string): Promise<QuestionPromptDto[]> {
    const lastAsked = await this.lastAskedMap(userId);

    // Sort all rotatable items by least-recently-asked.
    const sorted = [...ROTATABLE_ITEMS].sort((a, b) => {
      const ta = lastAsked.get(a.id)?.getTime() ?? 0;
      const tb = lastAsked.get(b.id)?.getTime() ?? 0;
      return ta - tb;
    });

    // Soft balancing: walk the sorted list, keep an even mix of PHQ-9 / GAD-7.
    const picked: QuestionnaireItem[] = [];
    const counts: Record<string, number> = { phq9: 0, gad7: 0 };
    const desiredPerInstrument = Math.ceil(QUESTIONS_PER_SESSION / 2);

    for (const item of sorted) {
      if (picked.length >= QUESTIONS_PER_SESSION) break;
      const tooMany = counts[item.instrument] >= desiredPerInstrument;
      const remainingSlots = QUESTIONS_PER_SESSION - picked.length;
      // Allow overflow if no items of the other instrument are left to add.
      const otherInstrument = item.instrument === 'phq9' ? 'gad7' : 'phq9';
      const otherRemaining = sorted
        .filter((s) => s.instrument === otherInstrument)
        .filter((s) => !picked.includes(s)).length;
      if (tooMany && otherRemaining >= remainingSlots) continue;
      picked.push(item);
      counts[item.instrument]++;
    }

    return picked.map((it) => ({
      id: it.id,
      instrument: it.instrument,
      index: it.index,
      text: it.text,
      voicePrompt: it.voicePrompt,
    }));
  }

  /**
   * Persist the answers the agent extracted during a session. Unknown
   * question_ids are dropped (defensive — the LLM can hallucinate ids).
   */
  async recordAnswers(
    userId: string,
    checkinId: string,
    askedAt: Date,
    answers: QuestionnaireAnswerDto[],
  ): Promise<number> {
    if (!answers || answers.length === 0) return 0;
    const valid = answers.filter((a) => {
      const item = ITEMS_BY_ID.get(a.questionId);
      if (!item) {
        this.logger.warn(
          `[questionnaire] dropping unknown questionId="${a.questionId}" from agent`,
        );
        return false;
      }
      if (a.score < 0 || a.score > 3) {
        this.logger.warn(
          `[questionnaire] dropping out-of-range score=${a.score} for ${a.questionId}`,
        );
        return false;
      }
      return true;
    });

    if (valid.length === 0) return 0;

    const rows = valid.map((a) => {
      const item = ITEMS_BY_ID.get(a.questionId)!;
      return this.responseRepo.create({
        userId,
        checkinId,
        questionId: a.questionId,
        instrument: item.instrument,
        score: a.score,
        rawAnswer: a.rawAnswer ?? null,
        askedAt,
      });
    });

    await this.responseRepo.save(rows);
    this.logger.log(
      `[questionnaire] persisted ${rows.length} answer(s) for checkin=${checkinId}`,
    );
    return rows.length;
  }

  /** Compute the latest PHQ-9 + GAD-7 totals over the last 14 days. */
  async summariseLatest(
    userId: string,
  ): Promise<QuestionnaireSummaryResponseDto> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - ROLLING_WINDOW_DAYS);

    const recent = await this.responseRepo.find({
      where: { userId, isDeleted: false, askedAt: MoreThanOrEqual(since) },
      order: { askedAt: 'DESC' },
    });

    const out: Partial<QuestionnaireSummaryResponseDto> = {};
    for (const def of INSTRUMENTS) {
      // Standard scoring needs ONE answer per item. If the user happened to
      // answer the same item twice in the window, take the most recent.
      const latestPerItem = new Map<string, QuestionnaireResponseEntity>();
      for (const row of recent) {
        if (row.instrument !== def.key) continue;
        if (!latestPerItem.has(row.questionId)) {
          latestPerItem.set(row.questionId, row);
        }
      }
      const responses = [...latestPerItem.values()];
      const itemsAnswered = responses.length;
      const itemsTotal = def.rotatableItems.length;
      const itemsPublished = def.publishedItems.length;

      // Standard PHQ-9 / GAD-7 scoring is a SUM of answered items. No
      // mean-imputation, no rescaling. PHQ-9 with item 9 excluded is the
      // PHQ-8 (Kroenke 2009) — same severity bands, max 24 instead of 27.
      const total = itemsAnswered > 0 ? sumScores(responses) : null;
      const validity = isValidCoverage(itemsAnswered, itemsTotal);
      const severity = total != null && validity ? def.severity(total) : null;
      const lastAnsweredAt =
        itemsAnswered > 0
          ? responses
              .reduce<Date>(
                (max, r) => (r.askedAt > max ? r.askedAt : max),
                new Date(0),
              )
              .toISOString()
          : null;

      out[def.key] = {
        instrument: def.key,
        total,
        maxScore: maxScoreForInstrument(def.publishedItems),
        severity,
        itemsAnswered,
        itemsTotal,
        itemsPublished,
        coverageValid: validity,
        lastAnsweredAt,
        windowDays: ROLLING_WINDOW_DAYS,
      };
    }

    return out as QuestionnaireSummaryResponseDto;
  }

  /** Map of `questionId -> most recent askedAt` for this user (all-time). */
  private async lastAskedMap(userId: string): Promise<Map<string, Date>> {
    const rows = await this.responseRepo
      .createQueryBuilder('r')
      .select('r.question_id', 'question_id')
      .addSelect('MAX(r.asked_at)', 'last_asked')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_deleted = false')
      .groupBy('r.question_id')
      .getRawMany<{ question_id: string; last_asked: Date }>();

    const map = new Map<string, Date>();
    for (const row of rows) {
      // last_asked may be returned as a string by some pg drivers.
      map.set(
        row.question_id,
        row.last_asked instanceof Date
          ? row.last_asked
          : new Date(row.last_asked),
      );
    }
    return map;
  }
}

export const QUESTIONNAIRE_QUESTIONS_PER_SESSION = QUESTIONS_PER_SESSION;
export const QUESTIONNAIRE_WINDOW_DAYS = ROLLING_WINDOW_DAYS;

// Re-export so the seed script can pull the canonical list without going
// through the constants barrel.
export { ALL_ITEMS };
