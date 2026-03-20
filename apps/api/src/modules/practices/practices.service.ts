import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, ConflictError } from '../../common/errors/app-error';
import { AuditAction } from '@medconnect/shared';
import type { CreatePracticeDto, UpdatePracticeDto, PracticeSettingsDto } from '@medconnect/shared';

@Injectable()
export class PracticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePracticeDto, userId: string) {
    // Check slug uniqueness
    const existing = await this.prisma.practice.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictError('A practice with this slug already exists');
    }

    const practice = await this.prisma.$transaction(async (tx) => {
      const p = await tx.practice.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          category: dto.category,
          timezone: dto.timezone ?? 'America/New_York',
          currency: dto.currency ?? 'USD',
          country: dto.country ?? 'US',
          contact_email: dto.contact_email,
          contact_phone: dto.contact_phone,
          address: dto.address ?? undefined,
          default_cancellation_policy: dto.default_cancellation_policy ?? undefined,
          reminder_settings: dto.reminder_settings ?? undefined,
        },
      });

      // Auto-create OWNER membership
      await tx.tenantMembership.create({
        data: {
          practice_id: p.id,
          user_id: userId,
          role: 'OWNER',
        },
      });

      // Auto-create provider profile for the owner
      await tx.providerProfile.create({
        data: {
          practice_id: p.id,
          user_id: userId,
          specialties: [],
          consultation_types: ['VIDEO'],
        },
      });

      return p;
    });

    await this.audit.log({
      user_id: userId,
      practice_id: practice.id,
      action: AuditAction.PRACTICE_CREATED,
      resource_type: 'practice',
      resource_id: practice.id,
      metadata: { name: practice.name, slug: practice.slug },
    });

    return practice;
  }

  async findById(id: string) {
    const practice = await this.prisma.practice.findUnique({
      where: { id },
    });
    if (!practice) {
      throw new NotFoundError('Practice', id);
    }
    return practice;
  }

  async findBySlug(slug: string) {
    const practice = await this.prisma.practice.findUnique({
      where: { slug },
    });
    if (!practice) {
      throw new NotFoundError('Practice');
    }
    return practice;
  }

  async update(id: string, dto: UpdatePracticeDto, userId: string) {
    await this.findById(id);

    const practice = await this.prisma.practice.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        timezone: dto.timezone,
        currency: dto.currency,
        country: dto.country,
        contact_email: dto.contact_email,
        contact_phone: dto.contact_phone,
        address: dto.address ?? undefined,
        default_cancellation_policy: dto.default_cancellation_policy ?? undefined,
        reminder_settings: dto.reminder_settings ?? undefined,
      },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: id,
      action: AuditAction.PRACTICE_UPDATED,
      resource_type: 'practice',
      resource_id: id,
    });

    return practice;
  }

  async updateSettings(id: string, dto: PracticeSettingsDto, userId: string) {
    await this.findById(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.logo_url !== undefined) data.logo_url = dto.logo_url;
    if (dto.cover_photo_url !== undefined) data.cover_photo_url = dto.cover_photo_url;
    if (dto.brand_color !== undefined) data.brand_color = dto.brand_color;
    if (dto.contact_email !== undefined) data.contact_email = dto.contact_email;
    if (dto.contact_phone !== undefined) data.contact_phone = dto.contact_phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.is_published !== undefined) data.is_published = dto.is_published;
    if (dto.default_cancellation_policy !== undefined) {
      data.default_cancellation_policy = dto.default_cancellation_policy;
    }
    if (dto.reminder_settings !== undefined) {
      data.reminder_settings = dto.reminder_settings;
    }

    const practice = await this.prisma.practice.update({
      where: { id },
      data,
    });

    await this.audit.log({
      user_id: userId,
      practice_id: id,
      action: AuditAction.PRACTICE_UPDATED,
      resource_type: 'practice',
      resource_id: id,
      metadata: { settings_keys: Object.keys(data) },
    });

    return practice;
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { user_id: userId, is_active: true },
      include: { practice: true },
    });
    return memberships.map((m) => ({
      ...m.practice,
      membership_role: m.role,
    }));
  }

  async getPublicProfile(slug: string) {
    const practice = await this.prisma.practice.findUnique({
      where: { slug },
      include: {
        provider_profiles: {
          include: {
            user: { select: { name: true, avatar_url: true } },
          },
        },
        services: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    if (!practice || !practice.is_published) {
      throw new NotFoundError('Practice');
    }
    return practice;
  }
}
