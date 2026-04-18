import { ApiProperty } from '@nestjs/swagger';
import { DivergenceComposite } from '../entities/triage-event.entity';
import { TrajectoryPointDto } from '../../trajectory/dto/trajectory-point.dto';

export class TriageEventDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  triggeredAt!: string;

  @ApiProperty({
    enum: DivergenceComposite,
    enumName: 'DivergenceComposite',
    description: 'Which composite (PHQ-9 or GAD-7) crossed threshold.',
  })
  composite!: DivergenceComposite;

  @ApiProperty({
    type: String,
    description: 'Human-readable explanation of the threshold crossing.',
  })
  triggerReason!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  triggeringCheckinId!: string;

  @ApiProperty({ type: Number, description: 'Personal baseline mean.' })
  baselineMean!: number;

  @ApiProperty({ type: Number, description: 'Personal baseline standard deviation.' })
  baselineStddev!: number;

  @ApiProperty({
    type: Number,
    description: 'Seven-day rolling average that crossed threshold.',
  })
  observedValue!: number;

  @ApiProperty({
    type: () => [TrajectoryPointDto],
    description:
      'Snapshot of the user trajectory at the moment of this event so the packet can render the chart without a second API call.',
  })
  trajectory!: TrajectoryPointDto[];
}

export class TriageEventListResponseDto {
  @ApiProperty({ type: () => [TriageEventDto] })
  data!: TriageEventDto[];

  @ApiProperty({ type: Number, example: 1 })
  total!: number;
}
