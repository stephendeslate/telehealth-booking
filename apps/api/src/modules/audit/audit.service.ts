import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditAction } from '@medconnect/shared';

export interface AuditLogEntry {
  user_id?: string;
  practice_id?: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  metadata?: Prisma.InputJsonValue;
  ip_address?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: entry.user_id,
          practice_id: entry.practice_id,
          action: entry.action,
          resource_type: entry.resource_type,
          resource_id: entry.resource_id,
          metadata: entry.metadata ?? undefined,
          ip_address: entry.ip_address,
        },
      });
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.error(`Failed to write audit log: ${error}`, {
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
      });
    }
  }

  async getByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        resource_type: resourceType,
        resource_id: resourceId,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getByUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async getByPractice(practiceId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { practice_id: practiceId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
