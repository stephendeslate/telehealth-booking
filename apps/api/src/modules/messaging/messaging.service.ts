import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error';
import { QUEUES } from '@medconnect/shared';
import type { SendMessageDto } from '@medconnect/shared';

const UNREAD_EMAIL_DELAY_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  async sendMessage(dto: SendMessageDto, senderId: string) {
    // Verify appointment and check sender is a participant
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointment_id },
      include: {
        provider_profile: { select: { user_id: true } },
      },
    });
    if (!appointment) throw new NotFoundError('Appointment not found');

    // BR-7: No messages to CANCELLED appointments
    if (appointment.status === 'CANCELLED') {
      throw new ForbiddenError('Cannot send messages to cancelled appointments');
    }

    // Verify sender is a participant
    const isPatient = appointment.patient_id === senderId;
    const isProvider = appointment.provider_profile.user_id === senderId;
    if (!isPatient && !isProvider) {
      // Check if OWNER/ADMIN of the practice
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          practice_id_user_id: {
            practice_id: appointment.practice_id,
            user_id: senderId,
          },
        },
      });
      if (!membership?.is_active || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new ForbiddenError('Not a participant in this appointment');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        practice_id: appointment.practice_id,
        appointment_id: dto.appointment_id,
        sender_id: senderId,
        type: 'TEXT',
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar_url: true } },
      },
    });

    // Determine recipient for offline email notification
    const recipientId = isPatient
      ? appointment.provider_profile.user_id
      : appointment.patient_id;

    // Schedule unread message email with 5min delay
    await this.notificationsQueue.add(
      'sendUnreadMessageEmail',
      { messageId: message.id, recipientId },
      {
        delay: UNREAD_EMAIL_DELAY_MS,
        jobId: `unread-msg-${message.id}`,
      },
    );

    return message;
  }

  async createSystemMessage(appointmentId: string, content: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { practice_id: true },
    });
    if (!appointment) return null;

    return this.prisma.message.create({
      data: {
        practice_id: appointment.practice_id,
        appointment_id: appointmentId,
        sender_id: null,
        type: 'SYSTEM',
        content,
      },
    });
  }

  async listMessages(appointmentId: string, userId: string, options: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    // Verify user is a participant
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { provider_profile: { select: { user_id: true } } },
    });
    if (!appointment) throw new NotFoundError('Appointment not found');

    const isParticipant =
      appointment.patient_id === userId ||
      appointment.provider_profile.user_id === userId;

    if (!isParticipant) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          practice_id_user_id: {
            practice_id: appointment.practice_id,
            user_id: userId,
          },
        },
      });
      if (!membership?.is_active || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new ForbiddenError('Not a participant in this appointment');
      }
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { appointment_id: appointmentId },
        include: {
          sender: { select: { id: true, name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { appointment_id: appointmentId } }),
    ]);

    return { data: messages, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async markRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        appointment: {
          include: { provider_profile: { select: { user_id: true } } },
        },
      },
    });
    if (!message) throw new NotFoundError('Message not found');

    // Only the recipient can mark as read (not the sender)
    if (message.sender_id === userId) {
      return message; // Sender's own message — already "read"
    }

    // Verify user is a participant
    const isPatient = message.appointment.patient_id === userId;
    const isProvider = message.appointment.provider_profile.user_id === userId;
    if (!isPatient && !isProvider) {
      throw new ForbiddenError('Not a participant in this appointment');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { read_at: new Date() },
      include: {
        sender: { select: { id: true, name: true, avatar_url: true } },
      },
    });
  }
}
