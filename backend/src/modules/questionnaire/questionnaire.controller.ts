import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireSummaryResponseDto } from './dto/questionnaire.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@ApiTags('questionnaire')
@ApiCookieAuth('session-cookie')
@UseGuards(JwtAuthGuard)
@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get('latest')
  @ApiOperation({
    summary: 'Latest PHQ-9 + GAD-7 totals over the last 14 days',
    description:
      'Aggregates the user\'s most recent PHQ-9 and GAD-7 item responses (asked by the voice agent during check-ins) into the standard total scores and severity bands. Items are deduped to the most recent answer within the rolling window; missing items are mean-imputed so partial coverage still yields a comparable 0-27 / 0-21 number.',
  })
  @ApiOkResponse({ type: QuestionnaireSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async latest(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuestionnaireSummaryResponseDto> {
    return this.service.summariseLatest(user.id);
  }
}
