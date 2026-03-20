import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateProviderProfileSchema,
  inviteProviderSchema,
  createAvailabilityRulesSchema,
  createBlockedDatesSchema,
  verifyInvitationSchema,
  MembershipRole,
} from '@medconnect/shared';
import type {
  UpdateProviderProfileDto,
  InviteProviderDto,
} from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('providers')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/providers')
@UseGuards(PracticeRolesGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'List providers in a practice' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async list(@Param('practiceId') practiceId: string) {
    return this.providersService.listProviders(practiceId);
  }

  @Get(':profileId')
  @ApiOperation({ summary: 'Get provider profile' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async getProfile(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.providersService.getProfile(practiceId, profileId);
  }

  @Patch(':profileId')
  @ApiOperation({ summary: 'Update provider profile' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async updateProfile(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
    @Body(new ZodValidationPipe(updateProviderProfileSchema)) dto: UpdateProviderProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.providersService.updateProfile(practiceId, profileId, dto, user.sub);
  }

  @Delete(':profileId')
  @ApiOperation({ summary: 'Deactivate a provider' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async deactivate(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.providersService.deactivateProvider(practiceId, profileId, user.sub);
  }

  // ─── Invitations ────────────────────────────

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new provider' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async invite(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(inviteProviderSchema)) dto: InviteProviderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.providersService.inviteProvider(practiceId, dto, user.sub);
  }

  @Get('invitations/list')
  @ApiOperation({ summary: 'List pending invitations' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async listInvitations(@Param('practiceId') practiceId: string) {
    return this.providersService.listInvitations(practiceId);
  }

  @Delete('invitations/:invitationId')
  @ApiOperation({ summary: 'Revoke a provider invitation' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async revokeInvitation(
    @Param('practiceId') practiceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.providersService.revokeInvitation(practiceId, invitationId, user.sub);
  }

  // ─── Availability Rules ────────────────────

  @Get(':profileId/availability')
  @ApiOperation({ summary: 'Get provider availability rules' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async getAvailability(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.providersService.getAvailabilityRules(practiceId, profileId);
  }

  @Post(':profileId/availability')
  @ApiOperation({ summary: 'Set provider availability rules' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async setAvailability(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
    @Body(new ZodValidationPipe(createAvailabilityRulesSchema)) body: { rules: any[] },
  ) {
    return this.providersService.setAvailabilityRules(practiceId, profileId, body.rules);
  }

  // ─── Blocked Dates ─────────────────────────

  @Get(':profileId/blocked-dates')
  @ApiOperation({ summary: 'Get provider blocked dates' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async getBlockedDates(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.providersService.getBlockedDates(practiceId, profileId);
  }

  @Post(':profileId/blocked-dates')
  @ApiOperation({ summary: 'Add provider blocked dates' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async addBlockedDates(
    @Param('practiceId') practiceId: string,
    @Param('profileId') profileId: string,
    @Body(new ZodValidationPipe(createBlockedDatesSchema)) body: { dates: any[] },
  ) {
    return this.providersService.addBlockedDates(practiceId, profileId, body.dates);
  }

  @Delete('blocked-dates/:blockedDateId')
  @ApiOperation({ summary: 'Remove a blocked date' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async removeBlockedDate(
    @Param('practiceId') practiceId: string,
    @Param('blockedDateId') blockedDateId: string,
  ) {
    return this.providersService.removeBlockedDate(practiceId, blockedDateId);
  }
}

// Separate controller for public invitation verification (no auth needed)
@ApiTags('providers')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly providersService: ProvidersService) {}

  @Public()
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify invitation token' })
  async verify(@Param('token') token: string) {
    return this.providersService.verifyInvitation(token);
  }
}
