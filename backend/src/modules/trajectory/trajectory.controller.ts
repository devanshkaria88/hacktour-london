import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TrajectoryService } from './trajectory.service';
import { TrajectoryResponseDto } from './dto/trajectory-point.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@ApiTags('trajectory')
@ApiCookieAuth('session-cookie')
@UseGuards(JwtAuthGuard)
@Controller('trajectory')
export class TrajectoryController {
  constructor(private readonly trajectoryService: TrajectoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the signed-in user trajectory',
    description:
      'Returns every check-in for the authenticated user ordered by recordedAt ascending, with the PHQ-9 and GAD-7 composite scores and a flag indicating whether each point triggered a divergence event.',
  })
  @ApiOkResponse({ type: TrajectoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async getTrajectory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrajectoryResponseDto> {
    return this.trajectoryService.buildTrajectory(user.id);
  }
}
