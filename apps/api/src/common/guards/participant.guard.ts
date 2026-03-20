import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenError } from '../errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard that ensures the current user is either:
 * - A participant in the appointment (patient or provider)
 * - A practice member (OWNER/ADMIN) for the appointment's practice
 *
 * Expects :appointmentId in route params.
 */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenError();
    }

    // PLATFORM_ADMIN bypasses
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    const appointmentId = request.params.appointmentId;
    if (!appointmentId) {
      throw new ForbiddenError('Appointment context required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        provider_profile: { select: { user_id: true } },
      },
    });

    if (!appointment) {
      throw new ForbiddenError('Appointment not found');
    }

    // Check if user is the patient
    if (appointment.patient_id === user.sub) {
      request.appointment = appointment;
      return true;
    }

    // Check if user is the provider
    if (appointment.provider_profile.user_id === user.sub) {
      request.appointment = appointment;
      return true;
    }

    // Check if user is an OWNER/ADMIN of the practice
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        practice_id_user_id: {
          practice_id: appointment.practice_id,
          user_id: user.sub,
        },
      },
    });

    if (membership?.is_active && ['OWNER', 'ADMIN'].includes(membership.role)) {
      request.appointment = appointment;
      return true;
    }

    throw new ForbiddenError('Not a participant in this appointment');
  }
}
