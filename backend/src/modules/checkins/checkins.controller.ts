import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { FromSessionCheckinDto } from './dto/from-session.dto';
import { CheckinResponseDto } from './dto/checkin-response.dto';
import { AgentSecretGuard } from '../../common/agent-secret.guard';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthService } from '../auth/auth.service';

const ACCEPTED_MIME_PREFIXES = ['audio/', 'video/webm'];
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

@ApiTags('checkins')
@Controller('checkins')
export class CheckinsController {
  constructor(
    private readonly checkinsService: CheckinsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('session-cookie')
  @ApiOperation({
    summary: 'Submit a voice check-in (legacy single-blob upload)',
    description:
      'Accepts an audio recording (multipart/form-data, field name "audio") for the signed-in user. The backend stores the audio, forwards it to the Python voice service for Speechmatics transcription and thymia Sentinel biomarker analysis, persists the result, runs divergence detection against the user history, and returns the full pipeline output. Kept as a fallback when the conversational LiveKit agent isn\'t reachable.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCheckinDto })
  @ApiCreatedResponse({ type: CheckinResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  @ApiUnprocessableEntityResponse({
    description: 'Audio file is missing, too large, or has an unsupported MIME type.',
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: CreateCheckinDto,
  ): Promise<CheckinResponseDto> {
    if (!file) {
      throw new BadRequestException('audio file is required');
    }
    if (!ACCEPTED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix))) {
      throw new BadRequestException(`unsupported audio mime type: ${file.mimetype}`);
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new BadRequestException('audio file exceeds 25 MB limit');
    }

    return this.checkinsService.createCheckin(
      user.id,
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      body.selfRating ?? null,
    );
  }

  @Post('from-session')
  @UseGuards(AgentSecretGuard)
  @ApiOperation({
    summary: 'Finalise a check-in from the LiveKit voice-agent worker',
    description:
      'Called by the voice-agent worker after a conversational check-in ends. The agent has already captured the user audio, sent it to the voice-service for biomarker analysis, and now hands the transcript + biomarkers + the userId (read from the LiveKit room metadata that the backend minted) to us for persistence + divergence detection. Authenticated by the X-Agent-Secret header.',
  })
  @ApiSecurity('agent-secret')
  @ApiHeader({
    name: 'X-Agent-Secret',
    description: 'Shared secret matching backend env VOICE_AGENT_SHARED_SECRET.',
    required: true,
  })
  @ApiCreatedResponse({ type: CheckinResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid agent secret.' })
  async createFromSession(
    @Body() body: FromSessionCheckinDto,
  ): Promise<CheckinResponseDto> {
    const owner = await this.authService.getById(body.userId);
    if (!owner) {
      throw new NotFoundException(
        `userId ${body.userId} (sent by agent) does not match any user.`,
      );
    }

    return this.checkinsService.createFromSession(body.userId, {
      sessionId: body.sessionId ?? null,
      transcript: body.transcript ?? null,
      biomarkers: body.biomarkers ?? null,
      audioDurationSec: body.audioDurationSec ?? 0,
      audioStoragePath: body.audioStoragePath ?? null,
      questionnaireResponses: body.questionnaireResponses,
    });
  }
}
