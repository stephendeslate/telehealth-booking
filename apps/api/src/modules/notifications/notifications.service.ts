import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors/app-error';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.notification.create({ data });
  }
}
