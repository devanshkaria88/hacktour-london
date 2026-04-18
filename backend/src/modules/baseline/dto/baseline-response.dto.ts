import { ApiProperty } from '@nestjs/swagger';

export class CompositeBaselineDto {
  @ApiProperty({ type: Number, description: 'Mean of the composite over the baseline window.', example: 0.41 })
  mean!: number;

  @ApiProperty({ type: Number, description: 'Standard deviation of the composite over the baseline window.', example: 0.07 })
  stddev!: number;
}

export class BaselineResponseDto {
  @ApiProperty({
    type: Boolean,
    description:
      'True once the user has at least seven check-ins so divergence detection can run.',
    example: true,
  })
  isEstablished!: boolean;

  @ApiProperty({
    type: Number,
    description: 'Number of check-ins counted toward the baseline.',
    example: 14,
  })
  checkinCount!: number;

  @ApiProperty({
    type: () => CompositeBaselineDto,
    nullable: true,
    description:
      'Baseline mean and stddev for the PHQ-9 composite. Null until baseline is established.',
  })
  phq9!: CompositeBaselineDto | null;

  @ApiProperty({
    type: () => CompositeBaselineDto,
    nullable: true,
    description:
      'Baseline mean and stddev for the GAD-7 composite. Null until baseline is established.',
  })
  gad7!: CompositeBaselineDto | null;
}
