import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'second_voice_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOpts: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SEVEN_DAYS_MS,
  path: '/',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Create a new account',
    description:
      'Hashes the password with Argon2id, creates a fresh user with no historical check-ins, ' +
      'and sets a 7-day httpOnly session cookie. Subsequent calls to /auth/me will return the user.',
  })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'An account with that email already exists.' })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, token } = await this.authService.signup(dto);
    res.cookie(COOKIE_NAME, token, cookieOpts);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email + password',
    description:
      'Verifies the Argon2id hash and (on success) sets the same 7-day httpOnly session cookie used by signup.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Wrong email or password.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, token } = await this.authService.login(dto);
    res.cookie(COOKIE_NAME, token, cookieOpts);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Clear the session cookie',
    description: 'Always returns 204. The frontend should treat this as authoritative log-out.',
  })
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    res.clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: 0 });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Return the currently signed-in user',
    description: 'Used by the frontend on app load to hydrate the auth slice.',
  })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    const fresh = await this.authService.getById(user.id);
    if (!fresh) {
      // Session JWT outlived the actual user row — nudge the client to re-auth.
      return { id: user.id, email: user.email, displayName: '' };
    }
    return this.authService.toPublic(fresh);
  }
}
