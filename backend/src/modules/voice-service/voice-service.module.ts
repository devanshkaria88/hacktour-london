import { Module } from '@nestjs/common';
import { VoiceServiceClient } from './voice-service.client';

@Module({
  providers: [VoiceServiceClient],
  exports: [VoiceServiceClient],
})
export class VoiceServiceModule {}
