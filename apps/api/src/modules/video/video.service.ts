import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error';
import { VIDEO_PROVIDER, type VideoProvider } from './video-provider.interface';
import { AuditAction, VIDEO_ROOM_HARD_LIMIT_MINUTES } from '@medconnect/shared';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(VIDEO_PROVIDER) private readonly videoProvider: VideoProvider,
  ) {}

  /**
   * Create a video room for a confirmed appointment.
   */
  async createRoom(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true, video_room: true },
    });

    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    if (appointment.video_room) {
      return appointment.video_room;
    }

    if (appointment.consultation_type !== 'VIDEO') {
      throw new ForbiddenError('Video rooms are only for VIDEO appointments');
    }

    const roomName = `appt_${appointmentId.replace(/-/g, '')}`;
    const maxParticipants = appointment.service?.max_participants || 2;

    const providerRoom = await this.videoProvider.createRoom(roomName, maxParticipants);

    const room = await this.prisma.videoRoom.create({
      data: {
        practice_id: appointment.practice_id,
        appointment_id: appointmentId,
        twilio_room_sid: providerRoom.sid,
        twilio_room_name: providerRoom.name,
        status: 'CREATED',
        max_participants: maxParticipants,
      },
    });

    await this.audit.log({
      practice_id: appointment.practice_id,
      action: AuditAction.VIDEO_ROOM_CREATED,
      resource_type: 'video_room',
      resource_id: room.id,
      metadata: { appointmentId } as any,
    });

    return room;
  }

  /**
   * Get or create a video room for an appointment.
   */
  async getRoom(appointmentId: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!room) {
      return this.createRoom(appointmentId);
    }

    return room;
  }

  /**
   * Generate a video access token for a user to join a room.
   */
  async generateToken(appointmentId: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        provider_profile: { select: { user_id: true } },
        video_room: true,
      },
    });

    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    // Verify participant
    const isParticipant =
      appointment.patient_id === userId ||
      appointment.provider_profile.user_id === userId;

    if (!isParticipant) {
      const membership = await this.prisma.tenantMembership.findFirst({
        where: {
          practice_id: appointment.practice_id,
          user_id: userId,
          is_active: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!membership) {
        throw new ForbiddenError('Not a participant in this appointment');
      }
    }

    // Ensure room exists
    let room = appointment.video_room;
    if (!room) {
      room = await this.createRoom(appointmentId);
    }

    // Token duration: appointment duration + 30 minutes
    const appointmentDuration = Math.ceil(
      (appointment.end_time.getTime() - appointment.start_time.getTime()) / (60 * 1000),
    );
    const tokenDuration = appointmentDuration + VIDEO_ROOM_HARD_LIMIT_MINUTES;

    const { token, roomName, expiresAt } = this.videoProvider.generateToken(
      room.twilio_room_name!,
      userId,
      tokenDuration,
    );

    // Track participant
    const existingParticipant = await this.prisma.videoParticipant.findFirst({
      where: { video_room_id: room.id, user_id: userId },
    });

    if (existingParticipant) {
      await this.prisma.videoParticipant.update({
        where: { id: existingParticipant.id },
        data: { joined_at: new Date(), left_at: null },
      });
    } else {
      await this.prisma.videoParticipant.create({
        data: {
          video_room_id: room.id,
          user_id: userId,
          joined_at: new Date(),
        },
      });
    }

    // Update room status if first join
    if (room.status === 'CREATED') {
      await this.prisma.videoRoom.update({
        where: { id: room.id },
        data: { status: 'WAITING' },
      });
    }

    await this.audit.log({
      user_id: userId,
      practice_id: appointment.practice_id,
      action: AuditAction.VIDEO_ROOM_JOINED,
      resource_type: 'video_room',
      resource_id: room.id,
    });

    return {
      token,
      room_name: roomName,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * End a video room.
   */
  async endRoom(appointmentId: string, userId?: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!room) throw new NotFoundError('VideoRoom', appointmentId);

    if (room.status === 'COMPLETED') {
      return room;
    }

    if (room.twilio_room_sid) {
      await this.videoProvider.endRoom(room.twilio_room_sid);
    }

    const now = new Date();
    const durationSeconds = room.started_at
      ? Math.round((now.getTime() - room.started_at.getTime()) / 1000)
      : 0;

    await this.prisma.videoParticipant.updateMany({
      where: { video_room_id: room.id, left_at: null },
      data: { left_at: now },
    });

    const updated = await this.prisma.videoRoom.update({
      where: { id: room.id },
      data: {
        status: 'COMPLETED',
        ended_at: now,
        actual_duration_seconds: durationSeconds,
      },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: room.practice_id,
      action: AuditAction.VIDEO_ROOM_ENDED,
      resource_type: 'video_room',
      resource_id: room.id,
    });

    return updated;
  }

  /**
   * Start a video room (WAITING → IN_PROGRESS).
   */
  async startRoom(appointmentId: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!room) throw new NotFoundError('VideoRoom', appointmentId);

    if (room.status === 'IN_PROGRESS' || room.status === 'COMPLETED') {
      return room;
    }

    return this.prisma.videoRoom.update({
      where: { id: room.id },
      data: {
        status: 'IN_PROGRESS',
        started_at: new Date(),
      },
    });
  }

  /**
   * Handle Twilio room-ended status callback.
   */
  async handleRoomEnded(twilioRoomSid: string) {
    const room = await this.prisma.videoRoom.findFirst({
      where: { twilio_room_sid: twilioRoomSid },
    });

    if (!room || room.status === 'COMPLETED') return;

    const now = new Date();
    const durationSeconds = room.started_at
      ? Math.round((now.getTime() - room.started_at.getTime()) / 1000)
      : 0;

    await this.prisma.videoParticipant.updateMany({
      where: { video_room_id: room.id, left_at: null },
      data: { left_at: now },
    });

    await this.prisma.videoRoom.update({
      where: { id: room.id },
      data: {
        status: 'COMPLETED',
        ended_at: now,
        actual_duration_seconds: durationSeconds,
      },
    });

    this.logger.log(`Room ended via Twilio callback: ${twilioRoomSid}`);
  }

  /**
   * Clean up video rooms that have exceeded their limits.
   */
  async cleanupRooms(): Promise<{ ended: number }> {
    const now = new Date();
    let ended = 0;

    const hardLimitCutoff = new Date(now.getTime() - VIDEO_ROOM_HARD_LIMIT_MINUTES * 60 * 1000);
    const overdueRooms = await this.prisma.videoRoom.findMany({
      where: {
        status: { in: ['CREATED', 'WAITING', 'IN_PROGRESS'] },
        appointment: { end_time: { lte: hardLimitCutoff } },
      },
      include: { appointment: true },
    });

    for (const room of overdueRooms) {
      try {
        await this.endRoom(room.appointment_id);
        ended++;
        this.logger.log(`Cleaned up overdue video room: ${room.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup room ${room.id}:`, error);
      }
    }

    return { ended };
  }
}
