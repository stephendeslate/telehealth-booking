import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors/app-error';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private gateway: { pushNotification(userId: string, notification: any): void } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    // Lazy-resolve MessagingGateway to avoid circular dependency
    try {
      // Dynamic import to avoid circular module dependency
      const { MessagingGateway } = require('../messaging/messaging.gateway');
      this.gateway = this.moduleRef.get(MessagingGateway, { strict: false });
    } catch {
      // Gateway not available (e.g., in tests) — notifications will be DB-only
    }
  }

  async list(userId: string, options: { unread_only?: boolean; page?: number; limit?: number }) {
    const { unread_only = false, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };
    if (unread_only) {
      where.read_at = null;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });
    if (!notification) throw new NotFoundError('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read_at: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return { marked: result.count };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { user_id: userId, read_at: null },
    });
  }

  /**
   * Create a notification and return it (for WebSocket push).
   */
  async create(data: {
    user_id: string;
    practice_id?: string;
    type: string;
    title: string;
    body: string;
    data?: any;
  }) {
    const notification = await this.prisma.notification.create({ data });

    // Push via WebSocket if gateway is available
    if (this.gateway) {
      this.gateway.pushNotification(data.user_id, notification);
    }

    return notification;
  }
}
