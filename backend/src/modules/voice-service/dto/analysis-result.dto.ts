import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Each dimension is a 0..1 score (or null when the upstream provider did not
 * emit it).
 *
 * IMPORTANT: every field MUST carry both an `@ApiProperty` (Swagger) AND a
 * full set of class-validator decorators. The global `ValidationPipe` runs
 * with `whitelist: true`, which silently strips any property without a
 * validator decorator. Without `@IsNumber`/`@IsOptional` here, biomarkers
 * posted by the voice-agent get dropped during validation and the persisted
 * row ends up entirely NULL even though the request body had real values.
 * That bug bit us once already — don't reintroduce it.
 */
const Dim = (): PropertyDecorator => {
  const apiProperty = ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1,
  });
  const isOptional = IsOptional();
  const isNumber = IsNumber();
  const min = Min(0);
  const max = Max(1);
  return (target, propertyKey) => {
    apiProperty(target, propertyKey);
    isOptional(target, propertyKey);
    isNumber(target, propertyKey);
    min(target, propertyKey);
    max(target, propertyKey);
  };
};

export class BiomarkersDto {
  // --- Apollo depression dimensions ---
  @Dim() anhedonia!: number | null;
  @Dim() lowMood!: number | null;
  @Dim() sleepIssues!: number | null;
  @Dim() lowEnergy!: number | null;
  @Dim() appetite!: number | null;
  @Dim() worthlessness!: number | null;
  @Dim() concentration!: number | null;
  @Dim() psychomotor!: number | null;

  // --- Apollo anxiety dimensions ---
  @Dim() nervousness!: number | null;
  @Dim() uncontrollableWorry!: number | null;
  @Dim() excessiveWorry!: number | null;
  @Dim() troubleRelaxing!: number | null;
  @Dim() restlessness!: number | null;
  @Dim() irritability!: number | null;
  @Dim() dread!: number | null;

  // --- Helios wellness dimensions ---
  @Dim() distress!: number | null;
  @Dim() stress!: number | null;
  @Dim() burnout!: number | null;
  @Dim() fatigue!: number | null;
  @Dim() lowSelfEsteem!: number | null;
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
