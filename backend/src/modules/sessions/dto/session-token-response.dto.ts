import { ApiProperty } from '@nestjs/swagger';

export class SessionTokenResponseDto {
  @ApiProperty({
    type: String,
    description: 'LiveKit Cloud websocket URL the browser should connect to.',
    example: 'wss://second-voice-xxxxx.livekit.cloud',
  })
  url!: string;

  @ApiProperty({
    type: String,
    description: 'Short-lived JWT (1 hour) authorising the browser to join the room.',
  })
  token!: string;

  @ApiProperty({
    type: String,
    description: 'Generated room name. The agent worker dispatches into this same room.',
    example: 'sv-demo-2026-04-18T19-22-11-1d3f',
  })
  roomName!: string;

  @ApiProperty({
    type: String,
    description: 'Stable identity used for the user participant in the room.',
    example: 'user-00000000-0000-4000-8000-000000000001',
  })
  identity!: string;

  @ApiProperty({
    type: String,
    description: 'Friendly display name shown to the agent.',
    example: 'Sam',
  })
  displayName!: string;

  @ApiProperty({
    type: String,
    description: 'Agent worker name that the LiveKit dispatcher will route to.',
    example: 'second-voice-checkin',
  })
  agentName!: string;
}
