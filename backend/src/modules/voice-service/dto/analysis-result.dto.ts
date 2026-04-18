import { ApiProperty } from '@nestjs/swagger';

export class BiomarkersDto {
  // --- Apollo depression dimensions ---
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  anhedonia!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  lowMood!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  sleepIssues!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  lowEnergy!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  appetite!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  worthlessness!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  concentration!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  psychomotor!: number | null;

  // --- Apollo anxiety dimensions ---
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  nervousness!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  uncontrollableWorry!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  excessiveWorry!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  troubleRelaxing!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  restlessness!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  irritability!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  dread!: number | null;

  // --- Helios wellness dimensions ---
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  distress!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  stress!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  burnout!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  fatigue!: number | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 1 })
  lowSelfEsteem!: number | null;
}

export class AnalysisResultDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Speechmatics medical-domain transcript of the audio.',
    example: 'It has been a tough week. I have not slept well and I feel tired.',
  })
  transcript!: string | null;

  @ApiProperty({
    type: () => BiomarkersDto,
    nullable: true,
    description:
      'thymia Sentinel biomarker readings across Apollo and Helios dimensions on a 0-1 scale.',
  })
  biomarkers!: BiomarkersDto | null;
}
