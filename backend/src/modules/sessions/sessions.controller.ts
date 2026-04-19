import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { SessionTokenResponseDto } from './dto/session-token-response.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthService } from '../auth/auth.service';

@ApiTags('sessions')
@ApiCookieAuth('session-cookie')
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly authService: AuthService,
  ) {}

  @Post('token')
  @ApiOperation({
    summary: 'Issue a LiveKit access token for the conversational check-in',
    description:
      'Mints a short-lived JWT for the signed-in user, generates a fresh room name, and instructs LiveKit Cloud to dispatch the olando-checkin agent worker into that room. The agent receives the userId via room metadata so it can post the resulting check-in back under the right account.',
  })
  @ApiCreatedResponse({ type: SessionTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  @ApiInternalServerErrorResponse({
    description: 'LiveKit credentials missing on the backend.',
  })
  async issueToken(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionTokenResponseDto> {
    const fresh = await this.authService.getById(user.id);
    const displayName = fresh?.displayName ?? user.email;
    return this.sessionsService.issueToken(user.id, displayName);
  }
}
