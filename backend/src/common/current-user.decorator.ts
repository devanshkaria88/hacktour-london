import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './jwt-auth.guard';

/**
 * Resolves the authenticated user attached to the request by `JwtAuthGuard`.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get()
 *   foo(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new Error(
        'CurrentUser decorator used without JwtAuthGuard — request has no user.',
      );
    }
    return req.user;
  },
);
