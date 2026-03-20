import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../providers/availability.service';
import {
  NotFoundError,
  ForbiddenError,
  SlotNoLongerAvailableError,
  SlotTemporarilyHeldError,
  InvalidAppointmentTransitionError,
} from '../../common/errors/app-error';
import {
  AuditAction,
  SLOT_RESERVATION_TTL_MINUTES,
  VALID_TRANSITIONS,
  DEFAULT_CANCELLATION_POLICY,
  PLATFORM_FEE_PERCENT,
} from '@medconnect/shared';
import type {
  ReserveSlotDto,
  CreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  AppointmentNotesDto,
} from '@medconnect/shared';

export interface CancellationResult {
  refund_type: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_REFUND' | 'NONE';
  refund_amount: number;
  fee: number;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly availability: AvailabilityService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── Slot Reservation ────────────────────────

  async reserveSlot(dto: ReserveSlotDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.service_id, practice_id: dto.practice_id, is_active: true },
    });
    if (!service) throw new NotFoundError('Service', dto.service_id);

    const endTime = new Date(
      new Date(dto.start_time).getTime() + service.duration_minutes * 60 * 1000,
    );
    const sessionId = `sess_${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + SLOT_RESERVATION_TTL_MINUTES * 60 * 1000);

    // Use raw SQL for pessimistic locking
    const reservation = await this.prisma.$transaction(async (tx) => {
      // Lock conflicting appointments
      const conflictingAppts: any[] = await tx.$queryRaw`
        SELECT id FROM appointments
        WHERE provider_profile_id = ${dto.provider_profile_id}::uuid
          AND start_time = ${new Date(dto.start_time)}
          AND status NOT IN ('CANCELLED', 'NO_SHOW')
        FOR UPDATE
      `;

      if (conflictingAppts.length > 0 && service.max_participants <= conflictingAppts.length) {
        throw new SlotNoLongerAvailableError();
      }

      // Lock conflicting reservations
      const conflictingRes: any[] = await tx.$queryRaw`
        SELECT id FROM slot_reservations
        WHERE provider_profile_id = ${dto.provider_profile_id}::uuid
          AND start_time = ${new Date(dto.start_time)}
          AND expires_at > NOW()
        FOR UPDATE
      `;

      if (conflictingRes.length > 0) {
        throw new SlotTemporarilyHeldError();
      }

      // Clean up expired reservations for this slot to avoid unique constraint violations
      await tx.slotReservation.deleteMany({
        where: {
          provider_profile_id: dto.provider_profile_id,
          start_time: new Date(dto.start_time),
          expires_at: { lte: new Date() },
        },
      });

      return tx.slotReservation.create({
        data: {
          practice_id: dto.practice_id,
          provider_profile_id: dto.provider_profile_id,
          start_time: new Date(dto.start_time),
          end_time: endTime,
          session_id: sessionId,
          expires_at: expiresAt,
        },
      });
    });

    return {
      reservation_id: reservation.id,
      session_id: reservation.session_id,
      start_time: reservation.start_time.toISOString(),
      end_time: reservation.end_time.toISOString(),
      expires_at: reservation.expires_at.toISOString(),
    };
  }

  // ─── Create Appointment ──────────────────────

  async createAppointment(
    dto: CreateAppointmentDto,
    userId: string | null,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Find reservation
    const reservation = await this.prisma.slotReservation.findFirst({
      where: {
        session_id: dto.reservation_session_id,
        practice_id: dto.practice_id,
        provider_profile_id: dto.provider_profile_id,
        expires_at: { gt: new Date() },
      },
    });

    if (!reservation) {
      throw new SlotNoLongerAvailableError();
    }

    // 2. Resolve patient
    let patientId: string;
    if (dto.patient_email) {
      // Guest checkout
      const patient = await this.findOrCreateGuestUser(
        dto.patient_email,
        dto.patient_name,
        dto.patient_phone,
      );
      patientId = patient.id;
    } else if (userId) {
      patientId = userId;
    } else {
      throw new ForbiddenError('Authentication or guest info required');
    }

    // 3. Resolve consultation type
    const service = await this.prisma.service.findUnique({
      where: { id: dto.service_id },
    });
    if (!service) throw new NotFoundError('Service', dto.service_id);

    let consultationType = service.consultation_type;
    if (consultationType === 'BOTH') {
      consultationType = dto.consultation_type || 'VIDEO';
    }

    // 4. Transactional booking
    const appointment = await this.prisma.$transaction(async (tx) => {
      // 4a. Lock reservation
      await tx.$queryRaw`
        SELECT id FROM slot_reservations
        WHERE id = ${reservation.id}::uuid
        FOR UPDATE
      `;

      // 4b. Verify no conflicting confirmed appointment
      const conflicting: any[] = await tx.$queryRaw`
        SELECT id FROM appointments
        WHERE provider_profile_id = ${dto.provider_profile_id}::uuid
          AND start_time = ${reservation.start_time}
          AND status NOT IN ('CANCELLED', 'NO_SHOW')
        FOR UPDATE
      `;

      if (conflicting.length > 0 && service.max_participants <= conflicting.length) {
        throw new SlotNoLongerAvailableError();
      }

      // 4c. Determine initial status
      let status: 'PENDING' | 'CONFIRMED' = 'PENDING';
      if (service.confirmation_mode === 'AUTO_CONFIRM') {
        // For free services or when no Stripe, auto-confirm immediately
        if (Number(service.price) === 0) {
          status = 'CONFIRMED';
        }
        // For paid services, stays PENDING until payment succeeds
        // (mock payment succeeds immediately in this phase)
        else {
          status = 'CONFIRMED'; // Mock: payment always succeeds
        }
      }

      // 4d. Create appointment
      const appt = await tx.appointment.create({
        data: {
          practice_id: dto.practice_id,
          provider_profile_id: dto.provider_profile_id,
          patient_id: patientId,
          service_id: dto.service_id,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          status,
          consultation_type: consultationType as any,
        },
      });

      // 4e. Delete reservation
      await tx.slotReservation.delete({
        where: { id: reservation.id },
      });

      // 4f. Mock payment (if price > 0)
      if (Number(service.price) > 0) {
        const amount = Number(service.price);
        const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100;

        await tx.paymentRecord.create({
          data: {
            practice_id: dto.practice_id,
            appointment_id: appt.id,
            amount,
            currency: 'USD',
            status: 'SUCCEEDED',
            stripe_payment_intent_id: `pi_mock_${randomBytes(12).toString('hex')}`,
            platform_fee: platformFee,
          },
        });
      }

      // 4g. Record consent
      const existingConsent = await tx.consentRecord.findFirst({
        where: { user_id: patientId, type: 'DATA_PROCESSING' },
      });
      if (!existingConsent) {
        await tx.consentRecord.create({
          data: {
            user_id: patientId,
            type: 'DATA_PROCESSING',
            version: '1.0',
            consented_at: new Date(),
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        });
      }

      return appt;
    });

    // 5. Audit log
    await this.audit.log({
      user_id: patientId,
      practice_id: dto.practice_id,
      action: AuditAction.APPOINTMENT_CREATED,
      resource_type: 'appointment',
      resource_id: appointment.id,
      metadata: { status: appointment.status } as Prisma.InputJsonValue,
    });

    if (appointment.status === 'CONFIRMED') {
      await this.audit.log({
        user_id: patientId,
        practice_id: dto.practice_id,
        action: AuditAction.APPOINTMENT_CONFIRMED,
        resource_type: 'appointment',
        resource_id: appointment.id,
      });

      this.events.emit('appointment.confirmed', {
        appointmentId: appointment.id,
        practiceId: dto.practice_id,
        status: 'CONFIRMED',
      });
    }

    return this.findById(appointment.id);
  }

  // ─── State Machine ───────────────────────────

  async transitionStatus(
    appointmentId: string,
    targetStatus: string,
    userId: string,
    metadata?: { reason?: string },
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    const validTargets = VALID_TRANSITIONS[appointment.status] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new InvalidAppointmentTransitionError(appointment.status, targetStatus);
    }

    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    if (targetStatus === 'IN_PROGRESS') {
      updateData.checked_in_at = new Date();
    }
    if (targetStatus === 'COMPLETED') {
      updateData.completed_at = new Date();
    }
    if (targetStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date();
      updateData.cancelled_by = userId;
      if (metadata?.reason) {
        updateData.cancellation_reason = metadata.reason;
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    // Audit
    const actionMap: Record<string, AuditAction> = {
      CONFIRMED: AuditAction.APPOINTMENT_CONFIRMED,
      CANCELLED: AuditAction.APPOINTMENT_CANCELLED,
    };
    const action = actionMap[targetStatus];
    if (action) {
      await this.audit.log({
        user_id: userId,
        practice_id: appointment.practice_id,
        action,
        resource_type: 'appointment',
        resource_id: appointmentId,
      });
    }

    // Emit state transition events
    const eventMap: Record<string, string> = {
      CONFIRMED: 'appointment.confirmed',
      CANCELLED: 'appointment.cancelled',
      COMPLETED: 'appointment.completed',
    };
    const eventName = eventMap[targetStatus];
    if (eventName) {
      this.events.emit(eventName, {
        appointmentId,
        practiceId: appointment.practice_id,
        status: targetStatus,
        previousStatus: appointment.status,
      });
    }

    return this.findById(updated.id);
  }

  // ─── Confirm (MANUAL_APPROVAL) ───────────────

  async confirmAppointment(appointmentId: string, userId: string) {
    return this.transitionStatus(appointmentId, 'CONFIRMED', userId);
  }

  // ─── Cancel ──────────────────────────────────

  async cancelAppointment(
    appointmentId: string,
    userId: string,
    dto: CancelAppointmentDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { practice: true },
    });
    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    // IN_PROGRESS cancellation requires admin role
    if (appointment.status === 'IN_PROGRESS') {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          practice_id_user_id: {
            practice_id: appointment.practice_id,
            user_id: userId,
          },
        },
      });
      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new ForbiddenError('Only admins can cancel in-progress appointments');
      }
    }

    // Evaluate cancellation policy
    const cancellationResult = await this.evaluateCancellationPolicy(appointment);

    // Perform cancellation
    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          cancellation_reason: dto.reason,
          cancelled_by: userId,
          cancelled_at: new Date(),
        },
      });

      // Process mock refund
      if (
        cancellationResult.refund_type === 'FULL_REFUND' ||
        cancellationResult.refund_type === 'PARTIAL_REFUND'
      ) {
        await tx.paymentRecord.updateMany({
          where: {
            appointment_id: appointmentId,
            status: 'SUCCEEDED',
          },
          data: {
            status:
              cancellationResult.refund_type === 'FULL_REFUND'
                ? 'REFUNDED'
                : 'PARTIALLY_REFUNDED',
            refund_amount: cancellationResult.refund_amount,
            refunded_at: new Date(),
          },
        });
      }
    });

    await this.audit.log({
      user_id: userId,
      practice_id: appointment.practice_id,
      action: AuditAction.APPOINTMENT_CANCELLED,
      resource_type: 'appointment',
      resource_id: appointmentId,
      metadata: {
        reason: dto.reason,
        refund: cancellationResult,
      } as unknown as Prisma.InputJsonValue,
    });

    this.events.emit('appointment.cancelled', {
      appointmentId,
      practiceId: appointment.practice_id,
      status: 'CANCELLED',
      previousStatus: appointment.status,
      cancelledBy: userId,
      cancellationReason: dto.reason,
    });

    return {
      appointment: await this.findById(appointmentId),
      cancellation: cancellationResult,
    };
  }

  // ─── Reschedule ──────────────────────────────

  async rescheduleAppointment(
    appointmentId: string,
    dto: RescheduleAppointmentDto,
    userId: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true },
    });
    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    if (appointment.status !== 'CONFIRMED') {
      throw new InvalidAppointmentTransitionError(appointment.status, 'RESCHEDULED');
    }

    // Verify the new reservation is valid
    const reservation = await this.prisma.slotReservation.findFirst({
      where: {
        session_id: dto.reservation_session_id,
        practice_id: appointment.practice_id,
        provider_profile_id: appointment.provider_profile_id,
        expires_at: { gt: new Date() },
      },
    });

    if (!reservation) {
      throw new SlotNoLongerAvailableError();
    }

    await this.prisma.$transaction(async (tx) => {
      // Update appointment times
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          start_time: reservation.start_time,
          end_time: reservation.end_time,
        },
      });

      // Delete the reservation
      await tx.slotReservation.delete({
        where: { id: reservation.id },
      });
    });

    await this.audit.log({
      user_id: userId,
      practice_id: appointment.practice_id,
      action: AuditAction.APPOINTMENT_RESCHEDULED,
      resource_type: 'appointment',
      resource_id: appointmentId,
      metadata: {
        original_start: appointment.start_time.toISOString(),
        new_start: reservation.start_time.toISOString(),
      } as Prisma.InputJsonValue,
    });

    this.events.emit('appointment.rescheduled', {
      oldAppointmentId: appointmentId,
      newAppointmentId: appointmentId,
      practiceId: appointment.practice_id,
    });

    return this.findById(appointmentId);
  }

  // ─── Update Notes ────────────────────────────

  async updateNotes(appointmentId: string, dto: AppointmentNotesDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { notes: dto.notes },
    });
  }

  // ─── Queries ─────────────────────────────────

  async findById(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        provider_profile: {
          include: {
            user: { select: { name: true, avatar_url: true } },
          },
        },
        patient: {
          select: { id: true, name: true, email: true },
        },
        service: {
          select: { id: true, name: true, duration_minutes: true, price: true },
        },
      },
    });
    if (!appointment) throw new NotFoundError('Appointment', appointmentId);

    return {
      ...appointment,
      service: appointment.service
        ? {
            ...appointment.service,
            price: Number(appointment.service.price),
          }
        : undefined,
      provider: {
        id: appointment.provider_profile.id,
        user: appointment.provider_profile.user,
        credentials: appointment.provider_profile.credentials,
      },
      provider_profile: undefined,
    };
  }

  async listForPractice(
    practiceId: string,
    options: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, from, to, page = 1, limit = 20 } = options;

    const where: Prisma.AppointmentWhereInput = {
      practice_id: practiceId,
    };
    if (status) where.status = status as any;
    if (from || to) {
      where.start_time = {};
      if (from) where.start_time.gte = new Date(from);
      if (to) where.start_time.lte = new Date(to);
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          provider_profile: {
            include: {
              user: { select: { name: true, avatar_url: true } },
            },
          },
          patient: {
            select: { id: true, name: true, email: true },
          },
          service: {
            select: { id: true, name: true, duration_minutes: true, price: true },
          },
        },
        orderBy: { start_time: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map((a) => ({
        ...a,
        service: a.service
          ? { ...a.service, price: Number(a.service.price) }
          : undefined,
        provider: {
          id: a.provider_profile.id,
          user: a.provider_profile.user,
          credentials: a.provider_profile.credentials,
        },
        provider_profile: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async listForPatient(
    patientId: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, page = 1, limit = 20 } = options;

    const where: Prisma.AppointmentWhereInput = {
      patient_id: patientId,
    };
    if (status) where.status = status as any;

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          provider_profile: {
            include: {
              user: { select: { name: true, avatar_url: true } },
            },
          },
          service: {
            select: { id: true, name: true, duration_minutes: true, price: true },
          },
          practice: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { start_time: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map((a) => ({
        ...a,
        service: a.service
          ? { ...a.service, price: Number(a.service.price) }
          : undefined,
        provider: {
          id: a.provider_profile.id,
          user: a.provider_profile.user,
          credentials: a.provider_profile.credentials,
        },
        provider_profile: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── Private Helpers ─────────────────────────

  private async findOrCreateGuestUser(
    email: string,
    name?: string,
    phone?: string,
  ) {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || 'Guest',
        password_hash: null as any, // Guest user — no password
        email_verified: false,
        role: 'USER',
        phone,
      },
    });
  }

  private async evaluateCancellationPolicy(
    appointment: { id: string; start_time: Date; practice_id: string; practice?: any },
  ): Promise<CancellationResult> {
    const practice =
      appointment.practice ||
      (await this.prisma.practice.findUnique({
        where: { id: appointment.practice_id },
      }));

    const policy =
      (practice?.default_cancellation_policy as any) || DEFAULT_CANCELLATION_POLICY;

    // Find payment
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { appointment_id: appointment.id, status: 'SUCCEEDED' },
    });

    if (!payment) {
      return { refund_type: 'NONE', refund_amount: 0, fee: 0 };
    }

    const amount = Number(payment.amount);
    const hoursUntilStart =
      (appointment.start_time.getTime() - Date.now()) / (1000 * 60 * 60);

    // Free cancellation window
    if (hoursUntilStart >= policy.free_cancel_hours) {
      return { refund_type: 'FULL_REFUND', refund_amount: amount, fee: 0 };
    }

    // No-refund window
    if (policy.no_refund_hours > 0 && hoursUntilStart <= policy.no_refund_hours) {
      return { refund_type: 'NO_REFUND', refund_amount: 0, fee: amount };
    }

    // Late cancellation
    const fee = Math.round((amount * policy.late_cancel_fee_percent) / 100 * 100) / 100;
    const refundAmount = Math.round((amount - fee) * 100) / 100;

    return {
      refund_type: 'PARTIAL_REFUND',
      refund_amount: refundAmount,
      fee,
    };
  }
}
