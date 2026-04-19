import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { AccessToken, RoomConfiguration, RoomAgentDispatch } from 'livekit-server-sdk';
import { randomBytes } from 'crypto';
import { SessionTokenResponseDto } from './dto/session-token-response.dto';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { QuestionPromptDto } from '../questionnaire/dto/questionnaire.dto';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly questionnaire: QuestionnaireService) {}

  async issueToken(
    userId: string,
    displayName: string,
  ): Promise<SessionTokenResponseDto> {
    const url = process.env.LIVEKIT_URL ?? '';
    const apiKey = process.env.LIVEKIT_API_KEY ?? '';
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? '';
    const agentName = process.env.LIVEKIT_AGENT_NAME ?? 'olando-checkin';

    if (!url || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'LiveKit credentials are not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in backend/.env.',
      );
    }

    const identity = `user-${userId}`;
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const suffix = randomBytes(2).toString('hex');
    const roomName = `ol-${stamp}-${suffix}`;

    // Pick the four PHQ-9/GAD-7 items the agent should weave into this
    // session. Selection prefers items the user hasn't been asked recently,
    // so coverage builds across both screens over multiple check-ins.
    const questions: QuestionPromptDto[] =
      await this.questionnaire.pickQuestionsForUser(userId);

    const metadata = JSON.stringify({
      userId,
      displayName,
      questions,
    });

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: '1h',
      metadata,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Explicit agent dispatch — LiveKit Cloud will summon a registered worker
    // with this name into the room as soon as the user connects. The metadata
    // travels with the dispatch so the agent knows whose check-in this is and
    // which PHQ-9/GAD-7 items to weave in.
    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName,
          metadata,
        }),
      ],
    });

    const token = await at.toJwt();

    this.logger.log(
      `Minted LiveKit token room=${roomName} identity=${identity} agent=${agentName} questions=${questions
        .map((q) => q.id)
        .join(',')}`,
    );

    return {
      url,
      token,
      roomName,
      identity,
      displayName,
      agentName,
    };
  }
}
