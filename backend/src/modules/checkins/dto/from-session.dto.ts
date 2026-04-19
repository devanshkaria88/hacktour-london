import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BiomarkersDto } from '../../voice-service/dto/analysis-result.dto';
import { QuestionnaireAnswerDto } from '../../questionnaire/dto/questionnaire.dto';

/**
 * Posted by the LiveKit voice-agent worker after the user ends a conversational
 * check-in. The agent has already captured the user's audio, sent it to the
 * voice-service for biomarker analysis, and now hands the result to the backend
 * for persistence + divergence detection.
 */
export class FromSessionCheckinDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'ID of the user the check-in belongs to. The agent reads this from the LiveKit room metadata that the backend baked into the session token, so it is trusted (the dispatcher only sends rooms minted by us).',
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'LiveKit room/session identifier so we can correlate logs.',
    example: 'ol-demo-2026-04-18T19-22-11',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Speechmatics transcript of the user side of the conversation.',
  })
  @IsOptional()
  @IsString()
  transcript!: string | null;

  @ApiProperty({
    type: () => BiomarkersDto,
    nullable: true,
    description: 'Biomarker readings produced by the voice-service from the user audio.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BiomarkersDto)
  biomarkers!: BiomarkersDto | null;

  @ApiProperty({
    type: Number,
    description: 'Total seconds of user audio captured during the session.',
    example: 42.7,
    minimum: 0,
    maximum: 3600,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(3600)
  audioDurationSec!: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Server-side path where the agent persisted the user audio (optional).',
  })
  @IsOptional()
  @IsString()
  audioStoragePath?: string;

  @ApiPropertyOptional({
    type: () => [QuestionnaireAnswerDto],
    description:
      'PHQ-9 / GAD-7 item answers the agent extracted during the session. Each one carries the standard 0-3 score plus the verbatim user reply for audit. The backend will dedupe unknown ids and out-of-range scores defensively.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionnaireAnswerDto)
  questionnaireResponses?: QuestionnaireAnswerDto[];
}
