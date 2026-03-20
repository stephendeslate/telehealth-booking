import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { MembershipRole } from '@medconnect/shared';

@ApiTags('calendar')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/providers/:providerId/calendar')
@UseGuards(JwtAuthGuard, PracticeRolesGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('connect')
  @ApiOperation({ summary: 'Connect external calendar' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async connect(
    @Param('providerId') providerId: string,
    @Body() body: { provider: string; auth_code: string; redirect_uri: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.calendarService.connect({
      providerProfileId: providerId,
      provider: body.provider as any,
      authCode: body.auth_code,
      redirectUri: body.redirect_uri,
      userId: user.sub,
    });
  }

  @Delete(':connectionId')
  @ApiOperation({ summary: 'Disconnect calendar' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async disconnect(
    @Param('connectionId') connectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.calendarService.disconnect(connectionId, user.sub);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get calendar connection status' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async getStatus(@Param('providerId') providerId: string) {
    return this.calendarService.getStatus(providerId);
  }
}
