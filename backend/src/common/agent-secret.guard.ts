import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Lightweight shared-secret guard for endpoints called by the voice-agent worker.
 * The worker passes `X-Agent-Secret: <VOICE_AGENT_SHARED_SECRET>`.
 * Hackathon auth, but better than none — keeps the from-session endpoint from
 * being a public write surface if anyone scans the API.
 */
@Injectable()
export class AgentSecretGuard implements CanActivate {
  private readonly logger = new Logger(AgentSecretGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.VOICE_AGENT_SHARED_SECRET ?? '';
    if (!expected) {
      this.logger.error(
        'VOICE_AGENT_SHARED_SECRET is not set — refusing all agent calls.',
      );
      throw new UnauthorizedException('agent secret not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided =
      (req.headers['x-agent-secret'] as string | undefined) ??
      (req.headers['X-Agent-Secret'] as unknown as string | undefined);
    if (!provided || provided !== expected) {
      this.logger.warn(
        `Rejected agent request from ${req.ip} — bad or missing X-Agent-Secret`,
      );
      throw new UnauthorizedException('invalid agent secret');
    }
    return true;
  }
}
