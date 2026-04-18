import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriageEventEntity } from './entities/triage-event.entity';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { TriagePacketService } from './triage-packet.service';
import { DivergenceDetectorService } from './divergence-detector.service';
import { TrajectoryModule } from '../trajectory/trajectory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TriageEventEntity]),
    TrajectoryModule,
  ],
  controllers: [TriageController],
  providers: [TriageService, TriagePacketService, DivergenceDetectorService],
  exports: [
    TriageService,
    DivergenceDetectorService,
    TypeOrmModule,
  ],
})
export class TriageModule {}
