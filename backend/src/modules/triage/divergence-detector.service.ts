import { Injectable } from '@nestjs/common';
import { CheckinEntity } from '../checkins/entities/checkin.entity';
import {
  BASELINE_MIN_CHECKINS,
  BASELINE_WINDOW_DAYS,
  DIVERGENCE_STDDEV_THRESHOLD,
  ROLLING_WINDOW_DAYS,
} from '../../common/constants';
import { DivergenceComposite } from './entities/triage-event.entity';
import { BaselineService } from '../baseline/baseline.service';

export interface DivergenceFinding {
  composite: DivergenceComposite;
  baselineMean: number;
  baselineStddev: number;
  observedValue: number;
  triggerReason: string;
}

@Injectable()
export class DivergenceDetectorService {
  /**
   * Examine a user's full ordered history of check-ins (oldest first) and
   * return a divergence finding if the seven-day rolling average of either
   * composite exceeds the personal baseline by more than two standard
   * deviations. Drops below baseline are never flagged.
   *
   * The history MUST include the latest check-in already persisted so that the
   * rolling average reflects the new reading.
   */
  detect(history: CheckinEntity[]): DivergenceFinding | null {
    if (history.length < BASELINE_MIN_CHECKINS) return null;

    const baselineWindow = history.slice(0, BASELINE_WINDOW_DAYS);
    const recentWindow = history.slice(-ROLLING_WINDOW_DAYS);

    const phq9Finding = this.evaluate(
      baselineWindow,
      recentWindow,
      DivergenceComposite.PHQ9,
    );
    if (phq9Finding) return phq9Finding;

    return this.evaluate(baselineWindow, recentWindow, DivergenceComposite.GAD7);
  }

  private evaluate(
    baselineWindow: CheckinEntity[],
    recentWindow: CheckinEntity[],
    composite: DivergenceComposite,
  ): DivergenceFinding | null {
    const accessor =
      composite === DivergenceComposite.PHQ9
        ? (c: CheckinEntity) => c.biomarkerReading?.phq9Composite ?? null
        : (c: CheckinEntity) => c.biomarkerReading?.gad7Composite ?? null;

    const baselineValues = baselineWindow
      .map(accessor)
      .filter((v): v is number => typeof v === 'number');
    const recentValues = recentWindow
      .map(accessor)
      .filter((v): v is number => typeof v === 'number');

    if (baselineValues.length === 0 || recentValues.length === 0) return null;

    const baselineStats = BaselineService.computeStats(baselineValues);
    if (!baselineStats) return null;

    const observedValue =
      recentValues.reduce((acc, v) => acc + v, 0) / recentValues.length;

    if (baselineStats.stddev === 0) return null;

    const stddevsFromMean =
      (observedValue - baselineStats.mean) / baselineStats.stddev;

    if (stddevsFromMean <= DIVERGENCE_STDDEV_THRESHOLD) return null;

    const compositeLabel =
      composite === DivergenceComposite.PHQ9 ? 'PHQ-9' : 'GAD-7';

    return {
      composite,
      baselineMean: baselineStats.mean,
      baselineStddev: baselineStats.stddev,
      observedValue,
      triggerReason:
        `Seven-day rolling average of ${compositeLabel} composite ` +
        `(${observedValue.toFixed(2)}) has exceeded the personal baseline ` +
        `(mean ${baselineStats.mean.toFixed(2)}, stddev ` +
        `${baselineStats.stddev.toFixed(2)}) by ${stddevsFromMean.toFixed(2)} ` +
        `standard deviations.`,
    };
  }
}
