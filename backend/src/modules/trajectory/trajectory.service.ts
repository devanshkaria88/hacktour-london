import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinEntity } from '../checkins/entities/checkin.entity';
import { TriageEventEntity } from '../triage/entities/triage-event.entity';
import {
  TrajectoryPointDto,
  TrajectoryResponseDto,
} from './dto/trajectory-point.dto';

@Injectable()
export class TrajectoryService {
  constructor(
    @InjectRepository(CheckinEntity)
    private readonly checkinRepo: Repository<CheckinEntity>,
    @InjectRepository(TriageEventEntity)
    private readonly triageRepo: Repository<TriageEventEntity>,
  ) {}

  async buildTrajectory(userId: string): Promise<TrajectoryResponseDto> {
    const points = await this.collectPoints(userId);
    return { data: points, total: points.length };
  }

  async collectPoints(userId: string): Promise<TrajectoryPointDto[]> {
    const checkins = await this.checkinRepo.find({
      where: { userId, isDeleted: false },
      relations: { biomarkerReading: true },
      order: { recordedAt: 'ASC' },
    });

    const triageCheckinIds = new Set(
      (
        await this.triageRepo.find({
          where: { userId, isDeleted: false },
          select: { triggeringCheckinId: true },
        })
      ).map((t) => t.triggeringCheckinId),
    );

    return checkins.map((checkin) => {
      const reading = checkin.biomarkerReading;
      return {
        checkinId: checkin.id,
        recordedAt: checkin.recordedAt.toISOString(),
        phq9Composite: reading?.phq9Composite ?? null,
        gad7Composite: reading?.gad7Composite ?? null,
        triggeredDivergence: triageCheckinIds.has(checkin.id),
        biomarkers: reading
          ? {
              // Apollo depression
              anhedonia: reading.anhedonia,
              lowMood: reading.lowMood,
              sleepIssues: reading.sleepIssues,
              lowEnergy: reading.lowEnergy,
              appetite: reading.appetite,
              worthlessness: reading.worthlessness,
              concentration: reading.concentration,
              psychomotor: reading.psychomotor,
              // Apollo anxiety
              nervousness: reading.nervousness,
              uncontrollableWorry: reading.uncontrollableWorry,
              excessiveWorry: reading.excessiveWorry,
              troubleRelaxing: reading.troubleRelaxing,
              restlessness: reading.restlessness,
              irritability: reading.irritability,
              dread: reading.dread,
              // Helios wellness
              distress: reading.distress,
              stress: reading.stress,
              burnout: reading.burnout,
              fatigue: reading.fatigue,
              lowSelfEsteem: reading.lowSelfEsteem,
            }
          : null,
      };
    });
  }
}
