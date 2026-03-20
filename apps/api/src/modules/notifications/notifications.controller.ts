import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { notificationListQuerySchema } from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(notificationListQuerySchema))
    query: { unread_only?: boolean; page?: number; limit?: number },
  ) {
    return this.notificationsService.list(user.sub, query);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }
}
