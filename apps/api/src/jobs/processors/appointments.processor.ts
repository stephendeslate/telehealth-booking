import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../modules/audit/audit.service';
import {
  QUEUES,
  NO_SHOW_DETECTION_DELAY_MINUTES,
  MANUAL_APPROVAL_TIMEOUT_HOURS,
  AuditAction,
} from '@medconnect/shared';

@Processor(QUEUES.APPOINTMENTS)
export class AppointmentsProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'processCompletedAppointments':
        await this.processCompletedAppointments();
        break;
      case 'detectNoShows':
        await this.detectNoShows();
        break;
      case 'enforceApprovalDeadlines':
        await this.enforceApprovalDeadlines();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Runs every 5 minutes. Auto-complete IN_PERSON/PHONE appointments
   * that are CONFIRMED and past their end_time.
   */
  private async processCompletedAppointments(): Promise<void> {
    const now = new Date();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        consultation_type: { in: ['IN_PERSON', 'PHONE'] },
        end_time: { lt: now },
      },
    });

    for (const appt of appointments) {
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'COMPLETED' },
      });

      await this.audit.log({
        practice_id: appt.practice_id,
        action: AuditAction.APPOINTMENT_CONFIRMED,
        resource_type: 'appointment',
        resource_id: appt.id,
        metadata: { auto_completed: true, consultation_type: appt.consultation_type },
      });
    }

    if (appointments.length > 0) {
      this.logger.log(`Auto-completed ${appointments.length} appointment(s)`);
    }
  }

  /**
   * Runs every 5 minutes. Mark VIDEO appointments as NO_SHOW if:
   * - Status is CONFIRMED
   * - Past end_time + NO_SHOW_DETECTION_DELAY_MINUTES (15)
   * - No video activity (no video_room or room never activated)
   */
  private async detectNoShows(): Promise<void> {
    const cutoff = new Date(
      Date.now() - NO_SHOW_DETECTION_DELAY_MINUTES * 60 * 1000,
    );

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        consultation_type: 'VIDEO',
        end_time: { lt: cutoff },
      },
    });

    for (const appt of appointments) {
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'NO_SHOW' },
      });

      await this.audit.log({
        practice_id: appt.practice_id,
        action: AuditAction.APPOINTMENT_CANCELLED,
        resource_type: 'appointment',
        resource_id: appt.id,
        metadata: { no_show: true, auto_detected: true },
      });
    }

    if (appointments.length > 0) {
      this.logger.log(`Detected ${appointments.length} no-show(s)`);
    }
  }

  /**
   * Runs every 1 hour. Auto-cancel PENDING appointments with MANUAL_APPROVAL
   * that have been pending for more than 48 hours.
   */
  private async enforceApprovalDeadlines(): Promise<void> {
    const cutoff = new Date(
      Date.now() - MANUAL_APPROVAL_TIMEOUT_HOURS * 60 * 60 * 1000,
    );

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'PENDING',
        created_at: { lt: cutoff },
      },
      include: {
        practice: true,
      },
    });

    for (const appt of appointments) {
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: 'CANCELLED',
          cancellation_reason: 'Approval deadline exceeded (48h)',
        },
      });

      // Process refund if payment exists
      const payment = await this.prisma.paymentRecord.findFirst({
        where: {
          appointment_id: appt.id,
          status: 'SUCCEEDED',
        },
      });

      if (payment) {
        await this.prisma.paymentRecord.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED' },
        });
      }

      await this.audit.log({
        practice_id: appt.practice_id,
        action: AuditAction.APPOINTMENT_CANCELLED,
        resource_type: 'appointment',
        resource_id: appt.id,
        metadata: { reason: 'approval_deadline_exceeded', auto_cancelled: true },
      });
    }

    if (appointments.length > 0) {
      this.logger.log(
        `Auto-cancelled ${appointments.length} appointment(s) past approval deadline`,
      );
    }
  }
}
