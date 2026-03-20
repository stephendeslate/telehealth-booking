import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors/app-error';
import type { CreateServiceDto, UpdateServiceDto } from '@medconnect/shared';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(practiceId: string, dto: CreateServiceDto) {
    const { provider_ids, ...serviceData } = dto;

    const service = await this.prisma.$transaction(async (tx) => {
      const s = await tx.service.create({
        data: {
          practice_id: practiceId,
          name: serviceData.name,
          description: serviceData.description,
          duration_minutes: serviceData.duration_minutes,
          price: serviceData.price ?? 0,
          consultation_type: serviceData.consultation_type as any ?? 'VIDEO',
          confirmation_mode: serviceData.confirmation_mode as any ?? 'AUTO_CONFIRM',
          intake_form_template_id: serviceData.intake_form_template_id,
          max_participants: serviceData.max_participants ?? 2,
          buffer_before_minutes: serviceData.buffer_before_minutes ?? 0,
          buffer_after_minutes: serviceData.buffer_after_minutes ?? 0,
          category: serviceData.category,
          is_active: serviceData.is_active ?? true,
          sort_order: serviceData.sort_order ?? 0,
        },
      });

      if (provider_ids && provider_ids.length > 0) {
        await Promise.all(
          provider_ids.map((providerProfileId) =>
            tx.serviceProvider.create({
              data: {
                service_id: s.id,
                provider_profile_id: providerProfileId,
              },
            }),
          ),
        );
      }

      return s;
    });

    return this.findById(practiceId, service.id);
  }

  async findById(practiceId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, practice_id: practiceId },
      include: {
        service_providers: {
          include: {
            provider_profile: {
              include: {
                user: { select: { name: true, avatar_url: true } },
              },
            },
          },
        },
        intake_form_template: {
          select: { id: true, name: true },
        },
      },
    });
    if (!service) throw new NotFoundError('Service', serviceId);

    return {
      ...service,
      providers: service.service_providers.map((sp) => ({
        id: sp.provider_profile.id,
        user: sp.provider_profile.user,
      })),
      service_providers: undefined,
    };
  }

  async list(practiceId: string) {
    const services = await this.prisma.service.findMany({
      where: { practice_id: practiceId },
      include: {
        service_providers: {
          include: {
            provider_profile: {
              include: {
                user: { select: { name: true, avatar_url: true } },
              },
            },
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });

    return services.map((s) => ({
      ...s,
      providers: s.service_providers.map((sp) => ({
        id: sp.provider_profile.id,
        user: sp.provider_profile.user,
      })),
      service_providers: undefined,
    }));
  }

  async update(practiceId: string, serviceId: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, practice_id: practiceId },
    });
    if (!existing) throw new NotFoundError('Service', serviceId);

    const { provider_ids, ...serviceData } = dto;

    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: {
          name: serviceData.name,
          description: serviceData.description,
          duration_minutes: serviceData.duration_minutes,
          price: serviceData.price,
          consultation_type: serviceData.consultation_type as any,
          confirmation_mode: serviceData.confirmation_mode as any,
          intake_form_template_id: serviceData.intake_form_template_id,
          max_participants: serviceData.max_participants,
          buffer_before_minutes: serviceData.buffer_before_minutes,
          buffer_after_minutes: serviceData.buffer_after_minutes,
          category: serviceData.category,
          is_active: serviceData.is_active,
          sort_order: serviceData.sort_order,
        },
      });

      if (provider_ids !== undefined) {
        await tx.serviceProvider.deleteMany({ where: { service_id: serviceId } });
        if (provider_ids.length > 0) {
          await Promise.all(
            provider_ids.map((providerProfileId) =>
              tx.serviceProvider.create({
                data: {
                  service_id: serviceId,
                  provider_profile_id: providerProfileId,
                },
              }),
            ),
          );
        }
      }
    });

    return this.findById(practiceId, serviceId);
  }

  async delete(practiceId: string, serviceId: string) {
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, practice_id: practiceId },
    });
    if (!existing) throw new NotFoundError('Service', serviceId);

    // Soft delete — mark inactive
    await this.prisma.service.update({
      where: { id: serviceId },
      data: { is_active: false },
    });

    return { message: 'Service deactivated' };
  }
}
