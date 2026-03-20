import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../common/errors/app-error';
import { AuditAction } from '@medconnect/shared';
import type {
  CreateProviderProfileDto,
  UpdateProviderProfileDto,
  InviteProviderDto,
  AvailabilityRuleDto,
  BlockedDateDto,
} from '@medconnect/shared';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Provider Profiles ───────────────────────

  async getProfile(practiceId: string, profileId: string) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, practice_id: practiceId },
      include: {
        user: { select: { name: true, email: true, avatar_url: true } },
        service_providers: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
    });
    if (!profile) throw new NotFoundError('Provider profile', profileId);
    return profile;
  }

  async listProviders(practiceId: string) {
    return this.prisma.providerProfile.findMany({
      where: { practice_id: practiceId },
      include: {
        user: { select: { name: true, email: true, avatar_url: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async updateProfile(
    practiceId: string,
    profileId: string,
    dto: UpdateProviderProfileDto,
    userId: string,
  ) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, practice_id: practiceId },
    });
    if (!profile) throw new NotFoundError('Provider profile', profileId);

    return this.prisma.providerProfile.update({
      where: { id: profileId },
      data: {
        specialties: dto.specialties,
        credentials: dto.credentials,
        bio: dto.bio,
        years_of_experience: dto.years_of_experience,
        education: dto.education,
        languages: dto.languages,
        accepting_new_patients: dto.accepting_new_patients,
        consultation_types: dto.consultation_types as any,
      },
      include: {
        user: { select: { name: true, email: true, avatar_url: true } },
      },
    });
  }

  async deactivateProvider(practiceId: string, profileId: string, userId: string) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, practice_id: practiceId },
    });
    if (!profile) throw new NotFoundError('Provider profile', profileId);

    // Cannot deactivate self (owner protection handled at guard level)
    if (profile.user_id === userId) {
      throw new ForbiddenError('Cannot deactivate your own provider profile');
    }

    await this.prisma.$transaction([
      this.prisma.tenantMembership.updateMany({
        where: {
          practice_id: practiceId,
          user_id: profile.user_id,
        },
        data: { is_active: false },
      }),
      this.prisma.providerProfile.update({
        where: { id: profileId },
        data: { accepting_new_patients: false },
      }),
    ]);

    await this.audit.log({
      user_id: userId,
      practice_id: practiceId,
      action: AuditAction.PROVIDER_REMOVED,
      resource_type: 'provider_profile',
      resource_id: profileId,
    });

    return { message: 'Provider deactivated' };
  }

  // ─── Invitations ────────────────────────────

  async inviteProvider(practiceId: string, dto: InviteProviderDto, invitedById: string) {
    // Check if already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      const existingMembership = await this.prisma.tenantMembership.findUnique({
        where: {
          practice_id_user_id: {
            practice_id: practiceId,
            user_id: existingUser.id,
          },
        },
      });
      if (existingMembership?.is_active) {
        throw new ConflictError('User is already a member of this practice');
      }
    }

    // Check for pending invitation
    const pendingInvite = await this.prisma.invitationToken.findFirst({
      where: {
        practice_id: practiceId,
        email: dto.email.toLowerCase(),
        accepted_at: null,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      throw new ConflictError('An invitation has already been sent to this email');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    await this.prisma.invitationToken.create({
      data: {
        practice_id: practiceId,
        email: dto.email.toLowerCase(),
        role: dto.role ?? 'PROVIDER',
        token_hash: tokenHash,
        invited_by: invitedById,
        expires_at: expiresAt,
      },
    });

    // Mock email
    this.logger.log(
      `[MOCK EMAIL] Provider invitation for ${dto.email}: /accept-invite?token=${rawToken}`,
    );

    return { message: 'Invitation sent', token: rawToken };
  }

  async verifyInvitation(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token_hash: tokenHash },
      include: { practice: { select: { name: true, slug: true } } },
    });

    if (
      !invitation ||
      invitation.revoked_at ||
      invitation.accepted_at ||
      invitation.expires_at < new Date()
    ) {
      throw new NotFoundError('Invitation');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      practice: invitation.practice,
    };
  }

  async revokeInvitation(practiceId: string, invitationId: string, userId: string) {
    const invitation = await this.prisma.invitationToken.findFirst({
      where: { id: invitationId, practice_id: practiceId },
    });
    if (!invitation) throw new NotFoundError('Invitation', invitationId);
    if (invitation.accepted_at || invitation.revoked_at) {
      throw new ConflictError('Invitation has already been accepted or revoked');
    }

    await this.prisma.invitationToken.update({
      where: { id: invitationId },
      data: { revoked_at: new Date() },
    });

    return { message: 'Invitation revoked' };
  }

  async listInvitations(practiceId: string) {
    return this.prisma.invitationToken.findMany({
      where: { practice_id: practiceId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expires_at: true,
        accepted_at: true,
        revoked_at: true,
        created_at: true,
      },
    });
  }

  // ─── Availability Rules ────────────────────

  async setAvailabilityRules(
    practiceId: string,
    profileId: string,
    rules: AvailabilityRuleDto[],
  ) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, practice_id: practiceId },
    });
    if (!profile) throw new NotFoundError('Provider profile', profileId);

    // Replace all existing rules
    await this.prisma.$transaction([
      this.prisma.availabilityRule.deleteMany({
        where: { provider_profile_id: profileId, practice_id: practiceId },
      }),
      ...rules.map((rule) =>
        this.prisma.availabilityRule.create({
          data: {
            practice_id: practiceId,
            provider_profile_id: profileId,
            day_of_week: rule.day_of_week,
            start_time: new Date(`1970-01-01T${rule.start_time}:00Z`),
            end_time: new Date(`1970-01-01T${rule.end_time}:00Z`),
            slot_duration_minutes: rule.slot_duration_minutes,
            is_active: rule.is_active ?? true,
          },
        }),
      ),
    ]);

    return this.getAvailabilityRules(practiceId, profileId);
  }

  async getAvailabilityRules(practiceId: string, profileId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { practice_id: practiceId, provider_profile_id: profileId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  // ─── Blocked Dates ─────────────────────────

  async addBlockedDates(
    practiceId: string,
    profileId: string,
    dates: BlockedDateDto[],
  ) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, practice_id: practiceId },
    });
    if (!profile) throw new NotFoundError('Provider profile', profileId);

    const created = await this.prisma.$transaction(
      dates.map((d) =>
        this.prisma.blockedDate.create({
          data: {
            practice_id: practiceId,
            provider_profile_id: profileId,
            start_date: new Date(d.start_date),
            end_date: new Date(d.end_date),
            reason: d.reason,
          },
        }),
      ),
    );

    return created;
  }

  async getBlockedDates(practiceId: string, profileId: string) {
    return this.prisma.blockedDate.findMany({
      where: { practice_id: practiceId, provider_profile_id: profileId },
      orderBy: { start_date: 'asc' },
    });
  }

  async removeBlockedDate(practiceId: string, blockedDateId: string) {
    const bd = await this.prisma.blockedDate.findFirst({
      where: { id: blockedDateId, practice_id: practiceId },
    });
    if (!bd) throw new NotFoundError('Blocked date', blockedDateId);

    await this.prisma.blockedDate.delete({ where: { id: blockedDateId } });
    return { message: 'Blocked date removed' };
  }
}
