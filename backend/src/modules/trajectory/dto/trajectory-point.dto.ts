import { ApiProperty } from '@nestjs/swagger';
import { BiomarkersDto } from '../../voice-service/dto/analysis-result.dto';

export class TrajectoryPointDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Identifier of the check-in this point represents.',
  })
  checkinId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp of the check-in.',
  })
  recordedAt!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Mean of the eight Apollo depression dimensions for this check-in (0-1).',
    example: 0.42,
  })
  phq9Composite!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Mean of the seven Apollo anxiety dimensions for this check-in (0-1).',
    example: 0.38,
  })
  gad7Composite!: number | null;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this check-in triggered a divergence event.',
    example: false,
  })
  triggeredDivergence!: boolean;

  @ApiProperty({
    type: () => BiomarkersDto,
    nullable: true,
    description:
      'Per-dimension Apollo + Helios biomarker readings (0-1) for this check-in. Null if the voice service was unavailable.',
  })
  biomarkers!: BiomarkersDto | null;
}

export class TrajectoryResponseDto {
  @ApiProperty({
    type: () => [TrajectoryPointDto],
    description: 'Trajectory points ordered ascending by recordedAt.',
  })
  data!: TrajectoryPointDto[];

  @ApiProperty({
    type: Number,
    description: 'Total number of points returned.',
    example: 14,
  })
  total!: number;
}
