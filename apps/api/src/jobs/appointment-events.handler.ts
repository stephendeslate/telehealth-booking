import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import {
  appointmentConfirmedTemplate,
  appointmentCancelledTemplate,
  appointmentRescheduledTemplate,
  intakeFormLinkTemplate,
  paymentReceiptTemplate,
} from './email-templates';
import { QUEUES, FOLLOW_UP_EMAIL_DELAY_HOURS } from '@medconnect/shared';

export interface AppointmentEvent {
  appointmentId: string;
  practiceId: string;
  status: string;
  previousStatus?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface AppointmentRescheduledEvent {
  oldAppointmentId: string;
  newAppointmentId: string;
  practiceId: string;
}

@Injectable()
export class AppointmentEventsHandler {
  private readonly logger = new Logger(AppointmentEventsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  @OnEvent('appointment.confirmed')
  async onAppointmentConfirmed(event: AppointmentEvent): Promise<void> {
    const appointment = await this.loadAppointment(event.appointmentId);
    if (!appointment) return;

    // 1. Send confirmation email to patient
    const startTime = appointment.start_time;
    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const template = appointmentConfirmedTemplate({
      practiceName: appointment.practice.name,
      patientName: appointment.patient.name,
      providerName: appointment.provider_profile.user.name,
      serviceName: appointment.service.name,
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      consultationType: appointment.consultation_type,
      detailUrl: `${webUrl}/appointments/${appointment.id}`,
    });

    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    // 2. Create in-app notification
    await this.prisma.notification.create({
      data: {
        user_id: appointment.patient_id,
        practice_id: appointment.practice_id,
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Appointment Confirmed',
        body: `Your ${appointment.service.name} appointment on ${dateStr} at ${timeStr} has been confirmed.`,
        data: { appointmentId: appointment.id } as any,
      },
    });

    // 3. Schedule reminders
    await this.scheduleReminders(appointment);

    // 4. Send intake form link if service has intake template
    if (appointment.service.intake_form_template_id) {
      const intakeTemplate = intakeFormLinkTemplate({
        practiceName: appointment.practice.name,
        patientName: appointment.patient.name,
        serviceName: appointment.service.name,
        appointmentDate: dateStr,
        intakeUrl: `${webUrl}/appointments/${appointment.id}/intake`,
      });

      await this.email.send({
        to: appointment.patient.email,
        subject: intakeTemplate.subject,
        html: intakeTemplate.html,
      });
    }

    this.logger.log(`Processed confirmed event for appointment ${event.appointmentId}`);
  }

  @OnEvent('appointment.cancelled')
  async onAppointmentCancelled(event: AppointmentEvent): Promise<void> {
    const appointment = await this.loadAppointment(event.appointmentId);
    if (!appointment) return;

    const startTime = appointment.start_time;
    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    // Send cancellation email to patient
    const template = appointmentCancelledTemplate({
      practiceName: appointment.practice.name,
      recipientName: appointment.patient.name,
      serviceName: appointment.service.name,
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      cancelledBy: event.cancelledBy || 'System',
      reason: event.cancellationReason,
      rebookUrl: `${webUrl}/book/${appointment.practice.slug}`,
    });

    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    // Create in-app notification
    await this.prisma.notification.create({
      data: {
        user_id: appointment.patient_id,
        practice_id: appointment.practice_id,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment Cancelled',
        body: `Your ${appointment.service.name} appointment on ${dateStr} has been cancelled.`,
        data: { appointmentId: appointment.id } as any,
      },
    });

    // Cancel scheduled reminders
    await this.cancelReminders(appointment.id);

    this.logger.log(`Processed cancelled event for appointment ${event.appointmentId}`);
  }

  @OnEvent('appointment.completed')
  async onAppointmentCompleted(event: AppointmentEvent): Promise<void> {
    // Schedule follow-up email 24h later
    const delayMs = FOLLOW_UP_EMAIL_DELAY_HOURS * 60 * 60 * 1000;

    await this.notificationsQueue.add(
      'sendFollowUpEmail',
      { appointmentId: event.appointmentId },
      {
        delay: delayMs,
        jobId: `follow-up-${event.appointmentId}`,
      },
    );

    this.logger.log(
      `Scheduled follow-up email for appointment ${event.appointmentId} in ${FOLLOW_UP_EMAIL_DELAY_HOURS}h`,
    );
  }

  @OnEvent('appointment.rescheduled')
  async onAppointmentRescheduled(event: AppointmentRescheduledEvent): Promise<void> {
    // Cancel old reminders
    await this.cancelReminders(event.oldAppointmentId);

    const appointment = await this.loadAppointment(event.newAppointmentId);
    if (!appointment) return;

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    // Load old appointment for context
    const oldAppt = await this.prisma.appointment.findUnique({
      where: { id: event.oldAppointmentId },
    });

    const newDate = appointment.start_time.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const newTime = appointment.start_time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const template = appointmentRescheduledTemplate({
      practiceName: appointment.practice.name,
      patientName: appointment.patient.name,
      serviceName: appointment.service.name,
      oldDate: oldAppt
        ? oldAppt.start_time.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'N/A',
      oldTime: oldAppt
        ? oldAppt.start_time.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'N/A',
      newDate,
      newTime,
      detailUrl: `${webUrl}/appointments/${appointment.id}`,
    });

    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    // Create notification
    await this.prisma.notification.create({
      data: {
        user_id: appointment.patient_id,
        practice_id: appointment.practice_id,
        type: 'APPOINTMENT_RESCHEDULED',
        title: 'Appointment Rescheduled',
        body: `Your ${appointment.service.name} appointment has been rescheduled to ${newDate} at ${newTime}.`,
        data: { appointmentId: appointment.id } as any,
      },
    });

    // Schedule new reminders
    if (appointment.status === 'CONFIRMED') {
      await this.scheduleReminders(appointment);
    }

    this.logger.log(
      `Processed rescheduled event: ${event.oldAppointmentId} → ${event.newAppointmentId}`,
    );
  }

  // ─── Helper Methods ───────────────────────────────────

  private async loadAppointment(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        provider_profile: { include: { user: true } },
        service: true,
        practice: true,
        intake_submission: true,
      },
    });
  }

  private async scheduleReminders(appointment: any): Promise<void> {
    const now = Date.now();
    const startMs = appointment.start_time.getTime();

    // Reminder schedule: [type, delayBeforeStart]
    const reminders: Array<{
      type: 'EMAIL_24H' | 'EMAIL_1H' | 'VIDEO_ROOM_READY';
      delayMs: number;
    }> = [
      { type: 'EMAIL_24H', delayMs: startMs - 24 * 60 * 60 * 1000 - now },
      { type: 'EMAIL_1H', delayMs: startMs - 60 * 60 * 1000 - now },
    ];

    // VIDEO_ROOM_READY only for video appointments
    if (appointment.consultation_type === 'VIDEO') {
      reminders.push({
        type: 'VIDEO_ROOM_READY',
        delayMs: startMs - 15 * 60 * 1000 - now,
      });
    }

    for (const reminder of reminders) {
      if (reminder.delayMs <= 0) {
        this.logger.log(
          `Skipping ${reminder.type} reminder for ${appointment.id} — appointment too soon`,
        );
        continue;
      }

      // Create reminder record
      await this.prisma.appointmentReminder.create({
        data: {
          practice_id: appointment.practice_id,
          appointment_id: appointment.id,
          type: reminder.type,
          scheduled_for: new Date(now + reminder.delayMs),
        },
      });

      // Schedule BullMQ job
      await this.notificationsQueue.add(
        'sendAppointmentReminder',
        {
          appointmentId: appointment.id,
          type: reminder.type,
        },
        {
          delay: reminder.delayMs,
          jobId: `reminder-${reminder.type.toLowerCase().replace('_', '-')}-${appointment.id}`,
        },
      );

      this.logger.log(
        `Scheduled ${reminder.type} reminder for appointment ${appointment.id} (delay: ${Math.round(reminder.delayMs / 60000)}min)`,
      );
    }

    // Schedule intake form reminder if service has intake template
    if (appointment.service.intake_form_template_id) {
      const intakeDelay = startMs - 24 * 60 * 60 * 1000 - now;
      if (intakeDelay > 0) {
        await this.notificationsQueue.add(
          'sendIntakeFormReminder',
          { appointmentId: appointment.id },
          {
            delay: intakeDelay,
            jobId: `intake-reminder-${appointment.id}`,
          },
        );
      }
    }
  }

  private async cancelReminders(appointmentId: string): Promise<void> {
    // Remove scheduled BullMQ jobs
    const jobIds = [
      `reminder-email-24h-${appointmentId}`,
      `reminder-email-1h-${appointmentId}`,
      `reminder-video-room-ready-${appointmentId}`,
      `intake-reminder-${appointmentId}`,
      `follow-up-${appointmentId}`,
    ];

    for (const jobId of jobIds) {
      try {
        const job = await this.notificationsQueue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.log(`Cancelled job ${jobId}`);
        }
      } catch {
        // Job may not exist — that's fine
      }
    }
  }
}
