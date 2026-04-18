import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinEntity } from '../checkins/entities/checkin.entity';
import {
  BASELINE_MIN_CHECKINS,
  BASELINE_WINDOW_DAYS,
} from '../../common/constants';
import { BaselineResponseDto } from './dto/baseline-response.dto';

interface CompositeStats {
  mean: number;
  stddev: number;
}

@Injectable()
export class BaselineService {
  constructor(
    @InjectRepository(CheckinEntity)
    private readonly checkinRepo: Repository<CheckinEntity>,
  ) {}

  async getBaseline(userId: string): Promise<BaselineResponseDto> {
    const checkins = await this.checkinRepo.find({
      where: { userId, isDeleted: false },
      relations: { biomarkerReading: true },
      order: { recordedAt: 'ASC' },
    });

    const total = checkins.length;
    if (total < BASELINE_MIN_CHECKINS) {
      return {
        isEstablished: false,
        checkinCount: total,
        phq9: null,
        gad7: null,
      };
    }

    const window = checkins.slice(0, BASELINE_WINDOW_DAYS);
    const phq9Values = window
      .map((c) => c.biomarkerReading?.phq9Composite)
      .filter((v): v is number => typeof v === 'number');
    const gad7Values = window
      .map((c) => c.biomarkerReading?.gad7Composite)
      .filter((v): v is number => typeof v === 'number');

    return {
      isEstablished: true,
      checkinCount: total,
      phq9: BaselineService.computeStats(phq9Values),
      gad7: BaselineService.computeStats(gad7Values),
    };
  }

  static computeStats(values: number[]): CompositeStats | null {
    if (values.length === 0) return null;
    const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
      Math.max(1, values.length - 1);
    return { mean, stddev: Math.sqrt(variance) };
  }
}
