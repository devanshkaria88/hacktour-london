import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionnaireResponseEntity } from './entities/questionnaire-response.entity';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireController } from './questionnaire.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionnaireResponseEntity])],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService, TypeOrmModule],
})
export class QuestionnaireModule {}
