import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** A single PHQ-9/GAD-7 item the agent should weave into the conversation. */
export class QuestionPromptDto {
  @ApiProperty({ example: 'phq9.3' })
  id!: string;

  @ApiProperty({ example: 'phq9', enum: ['phq9', 'gad7'] })
  instrument!: 'phq9' | 'gad7';

  @ApiProperty({ example: 3, description: '1-indexed item number.' })
  index!: number;

  @ApiProperty({
    description: 'Verbatim instrument wording. Shown in the triage report.',
  })
  text!: string;

  @ApiProperty({
    description: 'Softer, conversational rewording the agent should use.',
  })
  voicePrompt!: string;
}

/**
 * Returned to the FE alongside the LiveKit token so we can preview which
 * questions will be asked this session if we ever want to surface that.
 */
export class QuestionnairePlanDto {
  @ApiProperty({ type: () => [QuestionPromptDto] })
  questions!: QuestionPromptDto[];
}

/** A single answer the agent extracted, sent back in the finalise payload. */
export class QuestionnaireAnswerDto {
  @ApiProperty({ example: 'phq9.3' })
  @IsString()
  @MaxLength(32)
  questionId!: string;

  @ApiProperty({
    minimum: 0,
    maximum: 3,
    description:
      'Standard PHQ/GAD response level the LLM mapped the user reply onto: 0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  score!: number;

  @ApiPropertyOptional({
    description: 'Verbatim user reply. Useful for clinician audit / re-scoring.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rawAnswer?: string;
}

export class QuestionnaireAnswersWrapperDto {
  @ApiProperty({ type: () => [QuestionnaireAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionnaireAnswerDto)
  responses!: QuestionnaireAnswerDto[];
}

export class InstrumentSummaryDto {
  @ApiProperty({ enum: ['phq9', 'gad7'] })
  @IsIn(['phq9', 'gad7'])
  instrument!: 'phq9' | 'gad7';

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Standard PHQ-9/GAD-7 scoring: SUM of item responses (0-3 each) within the rolling window. PHQ-9 here is effectively the PHQ-8 since item 9 (suicidal ideation) is covered by the agent's safety prompt rather than asked directly — the PHQ-8 uses the same severity bands as PHQ-9 (Kroenke 2009), so the number is directly comparable. GAD-7 sums all 7 items. Null if the user has answered nothing in the window.",
  })
  total!: number | null;

  @ApiProperty({
    description:
      'Maximum possible total given the items we ask: 24 for PHQ-9 (PHQ-8 max — item 9 excluded), 21 for GAD-7.',
  })
  maxScore!: number;

  @ApiProperty({
    enum: ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe'],
    nullable: true,
    description:
      'Standard severity band derived from `total`. Bands are: 0-4 minimal · 5-9 mild · 10-14 moderate · 15-19 moderately severe · 20+ severe (PHQ-9 / PHQ-8); 0-4 minimal · 5-9 mild · 10-14 moderate · 15+ severe (GAD-7). Null when `total` is null OR when `coverageValid` is false (we refuse to derive a severity band from incomplete coverage to stay honest with the published scoring rules).',
  })
  severity!:
    | 'minimal'
    | 'mild'
    | 'moderate'
    | 'moderately_severe'
    | 'severe'
    | null;

  @ApiProperty({
    description:
      'Number of distinct items the user has answered inside the rolling window (deduped to most recent per item).',
  })
  itemsAnswered!: number;

  @ApiProperty({
    description:
      'Number of items the agent actually rotates through. PHQ-9 = 8 (Q9 excluded), GAD-7 = 7. This is what `itemsAnswered` is judged against for coverage.',
  })
  itemsTotal!: number;

  @ApiProperty({
    description:
      'Number of items in the full published instrument (PHQ-9 = 9, GAD-7 = 7). Mostly for FE labelling so users see "8 of 9 PHQ-9 items".',
  })
  itemsPublished!: number;

  @ApiProperty({
    description:
      'True when ≥80% of rotatable items have been answered in the window. This is the validity rule from the original PHQ-9 manual (Spitzer/Kroenke) — below 80% coverage the score is reported but `severity` is suppressed.',
  })
  coverageValid!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Most recent answer timestamp for any item in this instrument. Null if none.',
  })
  lastAnsweredAt!: string | null;

  @ApiProperty({
    description:
      'Days the rolling window covers. Standard PHQ-9/GAD-7 ask about the last 14 days.',
  })
  windowDays!: number;
}

export class QuestionnaireSummaryResponseDto {
  @ApiProperty({ type: () => InstrumentSummaryDto })
  phq9!: InstrumentSummaryDto;

  @ApiProperty({ type: () => InstrumentSummaryDto })
  gad7!: InstrumentSummaryDto;
}
