import { ApiProperty } from '@nestjs/swagger';
import { BiomarkersDto } from '../../voice-service/dto/analysis-result.dto';
import { TriageEventDto } from '../../triage/dto/triage-event.dto';

export class CheckinResponseDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'Identifier of the new check-in.' })
  checkinId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  recordedAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Speechmatics medical-domain transcript of the recording.',
  })
  transcript!: string | null;

  @ApiProperty({
    type: () => BiomarkersDto,
    nullable: true,
    description:
      'Apollo and Helios biomarker readings on a 0-1 scale, or null if the voice service was unavailable.',
  })
  biomarkers!: BiomarkersDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'PHQ-9 composite (mean of Apollo depression dimensions).',
  })
  phq9Composite!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'GAD-7 composite (mean of Apollo anxiety dimensions).',
  })
  gad7Composite!: number | null;

  @ApiProperty({
    type: Boolean,
    description: 'Whether this check-in tripped the divergence detector.',
  })
  divergenceDetected!: boolean;

  @ApiProperty({
    type: () => TriageEventDto,
    nullable: true,
    description:
      'The triage event that was created for this check-in, if one was triggered.',
  })
  triageEvent!: TriageEventDto | null;
}
