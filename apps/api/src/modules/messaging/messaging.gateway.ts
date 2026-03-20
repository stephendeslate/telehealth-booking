import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from './messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { JwtPayload } from '../auth/auth.service';

// Use a loose type since Socket.io's Socket is heavily generic
type AuthenticatedSocket = {
  id: string;
  user: JwtPayload;
  handshake: { auth?: Record<string, any>; headers?: Record<string, string> };
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  to(room: string): { emit(event: string, ...args: any[]): boolean };
  emit(event: string, ...args: any[]): boolean;
  disconnect(): void;
};

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  // Track typing state for auto-expiry (5s)
  private typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('Connection rejected: no token');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      client.user = payload;

      // Auto-subscribe to user's notification channel
      await client.join(`user:${payload.sub}:notifications`);

      this.logger.log(`Client connected: ${payload.sub} (${client.id})`);
    } catch {
      this.logger.warn(`Connection rejected: invalid token (${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.logger.log(`Client disconnected: ${client.user.sub} (${client.id})`);
    }
    // Clean up typing timers
    this.clearTypingTimer(client.id);
  }

  @SubscribeMessage('appointment:join')
  async handleJoinAppointment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { appointmentId: string },
  ) {
    if (!client.user) return;

    // Verify user is a participant
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { provider_profile: { select: { user_id: true } } },
    });

    if (!appointment) return;

    const isParticipant =
      appointment.patient_id === client.user.sub ||
      appointment.provider_profile.user_id === client.user.sub;

    if (!isParticipant) {
      const membership = await this.prisma.tenantMembership.findFirst({
        where: {
          practice_id: appointment.practice_id,
          user_id: client.user.sub,
          is_active: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!membership) return;
    }

    await client.join(`appointment:${data.appointmentId}`);
    this.logger.log(`${client.user.sub} joined appointment:${data.appointmentId}`);
  }

  @SubscribeMessage('appointment:leave')
  async handleLeaveAppointment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { appointmentId: string },
  ) {
    if (!client.user) return;
    await client.leave(`appointment:${data.appointmentId}`);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { appointmentId: string; content: string },
  ) {
    if (!client.user) return;

    try {
      const message = await this.messagingService.sendMessage(
        { appointment_id: data.appointmentId, content: data.content },
        client.user.sub,
      );

      // Broadcast to all participants in the appointment room
      this.server.to(`appointment:${data.appointmentId}`).emit('message:new', message);

      // Also send notification to recipient's personal channel
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: data.appointmentId },
        include: { provider_profile: { select: { user_id: true } } },
      });

      if (appointment) {
        const recipientId =
          appointment.patient_id === client.user.sub
            ? appointment.provider_profile.user_id
            : appointment.patient_id;

        // Create NEW_MESSAGE notification
        const notification = await this.notificationsService.create({
          user_id: recipientId,
          practice_id: appointment.practice_id,
          type: 'NEW_MESSAGE',
          title: 'New Message',
          body: data.content.length > 100 ? data.content.slice(0, 100) + '...' : data.content,
          data: { appointmentId: data.appointmentId, messageId: message.id },
        });

        this.server.to(`user:${recipientId}:notifications`).emit('notification:new', notification);
      }

      // Clear typing indicator
      this.clearTypingTimer(client.id);
      this.server.to(`appointment:${data.appointmentId}`).emit('typing:stop', {
        userId: client.user.sub,
        appointmentId: data.appointmentId,
      });
    } catch (error: any) {
      client.emit('message:error', { error: error.message });
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; appointmentId: string },
  ) {
    if (!client.user) return;

    try {
      const message = await this.messagingService.markRead(data.messageId, client.user.sub);

      // Notify sender of read receipt
      this.server.to(`appointment:${data.appointmentId}`).emit('message:read_receipt', {
        messageId: data.messageId,
        readBy: client.user.sub,
        readAt: message.read_at,
      });
    } catch {
      // Silently fail — read receipts are best-effort
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { appointmentId: string },
  ) {
    if (!client.user) return;

    // Broadcast typing indicator
    client.to(`appointment:${data.appointmentId}`).emit('typing:indicator', {
      userId: client.user.sub,
      appointmentId: data.appointmentId,
      isTyping: true,
    });

    // Auto-expire after 5 seconds
    this.clearTypingTimer(client.id);
    const timer = setTimeout(() => {
      client.to(`appointment:${data.appointmentId}`).emit('typing:indicator', {
        userId: client.user.sub,
        appointmentId: data.appointmentId,
        isTyping: false,
      });
      this.typingTimers.delete(client.id);
    }, 5000);

    this.typingTimers.set(client.id, timer);
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { appointmentId: string },
  ) {
    if (!client.user) return;

    this.clearTypingTimer(client.id);
    client.to(`appointment:${data.appointmentId}`).emit('typing:indicator', {
      userId: client.user.sub,
      appointmentId: data.appointmentId,
      isTyping: false,
    });
  }

  // ─── Public methods for other services to push events ───

  pushNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}:notifications`).emit('notification:new', notification);
  }

  pushVideoStatus(appointmentId: string, status: any) {
    this.server.to(`appointment:${appointmentId}`).emit('video:status', status);
  }

  pushParticipantJoined(appointmentId: string, participant: any) {
    this.server.to(`appointment:${appointmentId}`).emit('video:participant_joined', participant);
  }

  pushParticipantLeft(appointmentId: string, participant: any) {
    this.server.to(`appointment:${appointmentId}`).emit('video:participant_left', participant);
  }

  // ─── Helpers ───

  private clearTypingTimer(clientId: string) {
    const timer = this.typingTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(clientId);
    }
  }
}
