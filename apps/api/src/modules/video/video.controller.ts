import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('video')
@ApiBearerAuth('JWT')
@Controller('appointments/:appointmentId/video')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('room')
  @ApiOperation({ summary: 'Get video room status' })
  async getRoom(@Param('appointmentId') appointmentId: string) {
    return this.videoService.getRoom(appointmentId);
  }

  @Post('token')
  @ApiOperation({ summary: 'Generate video room token' })
  async getToken(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.videoService.generateToken(appointmentId, user.sub);
  }

  @Post('end')
  @ApiOperation({ summary: 'End video room session' })
  async endRoom(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.videoService.endRoom(appointmentId, user.sub);
  }
}

/**
 * Twilio Video webhook controller for room status callbacks.
 */
@ApiTags('video')
@Controller('webhooks/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly videoService: VideoService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Handle Twilio Video status callback' })
  async handleStatusCallback(@Body() body: any) {
    const { RoomName, RoomSid, RoomStatus, StatusCallbackEvent } = body;

    this.logger.log(
      `Twilio callback: ${StatusCallbackEvent} for room ${RoomName} (${RoomSid}) — status: ${RoomStatus}`,
    );

    if (StatusCallbackEvent === 'room-ended') {
      await this.videoService.handleRoomEnded(RoomSid);
    }

    return { received: true };
  }
}
