import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinEntity } from './entities/checkin.entity';
import { BiomarkerReadingEntity } from '../biomarkers/entities/biomarker-reading.entity';
import { TriageEventEntity } from '../triage/entities/triage-event.entity';
import { CheckinsService } from './checkins.service';
import { CheckinsController } from './checkins.controller';
import { VoiceServiceModule } from '../voice-service/voice-service.module';
import { TriageModule } from '../triage/triage.module';
import { TrajectoryModule } from '../trajectory/trajectory.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CheckinEntity,
      BiomarkerReadingEntity,
      TriageEventEntity,
    ]),
    VoiceServiceModule,
    TriageModule,
    TrajectoryModule,
    QuestionnaireModule,
  ],
  controllers: [CheckinsController],
  providers: [CheckinsService],
  exports: [TypeOrmModule, CheckinsService],
})
export class CheckinsModule {}
