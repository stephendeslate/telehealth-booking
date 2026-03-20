import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sendMessageSchema, messageListQuerySchema } from '@medconnect/shared';
import type { SendMessageDto } from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('messages')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('appointments/:appointmentId/messages')
  @ApiOperation({ summary: 'List messages for an appointment' })
  async listMessages(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(messageListQuerySchema))
    query: { page?: number; limit?: number },
  ) {
    return this.messagingService.listMessages(appointmentId, user.sub, query);
  }

  @Post('appointments/:appointmentId/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @Param('appointmentId') appointmentId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Override appointment_id from URL param for consistency
    return this.messagingService.sendMessage(
      { ...dto, appointment_id: appointmentId },
      user.sub,
    );
  }

  @Patch('messages/:messageId/read')
  @ApiOperation({ summary: 'Mark message as read' })
  async markRead(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagingService.markRead(messageId, user.sub);
  }
}
