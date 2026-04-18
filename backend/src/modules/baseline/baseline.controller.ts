import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BaselineService } from './baseline.service';
import { BaselineResponseDto } from './dto/baseline-response.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@ApiTags('baseline')
@ApiCookieAuth('session-cookie')
@UseGuards(JwtAuthGuard)
@Controller('baseline')
export class BaselineController {
  constructor(private readonly baselineService: BaselineService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the signed-in user baseline',
    description:
      'Returns the user personal baseline mean and standard deviation for the PHQ-9 and GAD-7 composites computed over the first fourteen check-ins. Returns null composites with isEstablished=false until at least seven check-ins exist.',
  })
  @ApiOkResponse({ type: BaselineResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async getBaseline(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BaselineResponseDto> {
    return this.baselineService.getBaseline(user.id);
  }
}
