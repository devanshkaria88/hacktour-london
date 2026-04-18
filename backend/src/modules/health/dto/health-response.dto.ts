import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Service status indicator.' })
  status!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-04-18T14:00:00.000Z',
    description: 'Server timestamp at the moment of the health check.',
  })
  timestamp!: string;
}
