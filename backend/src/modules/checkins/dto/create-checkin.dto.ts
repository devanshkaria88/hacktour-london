import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateCheckinDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Audio recording (wav, webm, mp3, m4a, ogg). Max 25 MB.',
  })
  audio!: unknown;

  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 10,
    required: false,
    description: 'Optional self-rating from 1 (terrible) to 10 (excellent).',
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  selfRating?: number;
}
