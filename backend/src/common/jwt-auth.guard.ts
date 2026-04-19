import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '../modules/auth/auth.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('not authenticated');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      (req as Request & { user?: AuthenticatedUser }).user = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('invalid or expired session');
    }
  }

  private extractToken(req: Request): string | null {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'olando_session';
    const cookieToken = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[cookieName];
    if (cookieToken) return cookieToken;

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

    return null;
  }
}
