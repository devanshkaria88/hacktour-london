import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinEntity } from '../checkins/entities/checkin.entity';
import { TriageEventEntity } from '../triage/entities/triage-event.entity';
import { TrajectoryService } from './trajectory.service';
import { TrajectoryController } from './trajectory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CheckinEntity, TriageEventEntity])],
  controllers: [TrajectoryController],
  providers: [TrajectoryService],
  exports: [TrajectoryService],
})
export class TrajectoryModule {}
