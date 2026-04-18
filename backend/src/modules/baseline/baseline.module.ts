import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinEntity } from '../checkins/entities/checkin.entity';
import { BaselineService } from './baseline.service';
import { BaselineController } from './baseline.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CheckinEntity])],
  controllers: [BaselineController],
  providers: [BaselineService],
  exports: [BaselineService],
})
export class BaselineModule {}
