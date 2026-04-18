import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckinsModule } from './modules/checkins/checkins.module';
import { TrajectoryModule } from './modules/trajectory/trajectory.module';
import { BaselineModule } from './modules/baseline/baseline.module';
import { TriageModule } from './modules/triage/triage.module';
import { VoiceServiceModule } from './modules/voice-service/voice-service.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { QuestionnaireModule } from './modules/questionnaire/questionnaire.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
    }),
    UsersModule,
    AuthModule,
    VoiceServiceModule,
    CheckinsModule,
    TrajectoryModule,
    BaselineModule,
    TriageModule,
    SessionsModule,
    QuestionnaireModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
