import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TriageService } from './triage.service';
import { TriagePacketService } from './triage-packet.service';
import { TriageEventListResponseDto } from './dto/triage-event.dto';
import { JwtAuthGuard, AuthenticatedUser } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@ApiTags('triage')
@ApiCookieAuth('session-cookie')
@UseGuards(JwtAuthGuard)
@Controller('triage-events')
export class TriageController {
  constructor(
    private readonly triageService: TriageService,
    private readonly packetService: TriagePacketService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List triage events for the signed-in user',
    description:
      'Returns every divergence event the system has detected for the authenticated user, ordered by triggeredAt descending. Each event carries a snapshot of the user trajectory so the packet can render without a second call.',
  })
  @ApiOkResponse({ type: TriageEventListResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TriageEventListResponseDto> {
    return this.triageService.listForUser(user.id);
  }

  @Get(':id/packet')
  @ApiOperation({
    summary: 'Generate a one-page triage packet PDF',
    description:
      'Produces a one-page PDF summary of the divergence event suitable for handing to a GP. Streams application/pdf bytes.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'A binary PDF document.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie.' })
  async packet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.packetService.renderPacket(user.id, id);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="olando-triage-${id}.pdf"`,
        'Content-Length': pdf.length,
      })
      .send(pdf);
  }
}
