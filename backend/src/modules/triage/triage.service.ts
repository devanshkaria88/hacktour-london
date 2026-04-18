import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TriageEventEntity } from './entities/triage-event.entity';
import { TrajectoryService } from '../trajectory/trajectory.service';
import {
  TriageEventDto,
  TriageEventListResponseDto,
} from './dto/triage-event.dto';

@Injectable()
export class TriageService {
  constructor(
    @InjectRepository(TriageEventEntity)
    private readonly triageRepo: Repository<TriageEventEntity>,
    private readonly trajectoryService: TrajectoryService,
  ) {}

  async listForUser(userId: string): Promise<TriageEventListResponseDto> {
    const events = await this.triageRepo.find({
      where: { userId, isDeleted: false },
      order: { triggeredAt: 'DESC' },
    });
    const trajectory = await this.trajectoryService.collectPoints(userId);
    const data = events.map((event) => this.toDto(event, trajectory));
    return { data, total: data.length };
  }

  async getEvent(userId: string, id: string): Promise<TriageEventEntity> {
    const event = await this.triageRepo.findOne({
      where: { id, userId, isDeleted: false },
      relations: { triggeringCheckin: { biomarkerReading: true } },
    });
    if (!event) {
      throw new NotFoundException(`Triage event ${id} not found.`);
    }
    return event;
  }

  async getEventDto(userId: string, id: string): Promise<TriageEventDto> {
    const event = await this.getEvent(userId, id);
    const trajectory = await this.trajectoryService.collectPoints(userId);
    return this.toDto(event, trajectory);
  }

  private toDto(
    event: TriageEventEntity,
    trajectory: Awaited<ReturnType<TrajectoryService['collectPoints']>>,
  ): TriageEventDto {
    return {
      id: event.id,
      triggeredAt: event.triggeredAt.toISOString(),
      composite: event.composite,
      triggerReason: event.triggerReason,
      triggeringCheckinId: event.triggeringCheckinId,
      baselineMean: event.baselineMean,
      baselineStddev: event.baselineStddev,
      observedValue: event.observedValue,
      trajectory,
    };
  }
}
