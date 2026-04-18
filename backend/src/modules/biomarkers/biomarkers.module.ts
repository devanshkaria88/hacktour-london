import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiomarkerReadingEntity } from './entities/biomarker-reading.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BiomarkerReadingEntity])],
  exports: [TypeOrmModule],
})
export class BiomarkersModule {}
