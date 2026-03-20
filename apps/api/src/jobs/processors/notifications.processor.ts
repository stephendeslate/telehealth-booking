import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email.service';
import {
  appointmentReminder24hTemplate,
  appointmentReminder1hTemplate,
  appointmentFollowUpTemplate,
  intakeFormReminderTemplate,
  unreadMessageTemplate,
} from '../email-templates';
import { QUEUES } from '@medconnect/shared';

export interface ReminderJobData {
  appointmentId: string;
  type: 'EMAIL_24H' | 'EMAIL_1H' | 'VIDEO_ROOM_READY';
}

export interface FollowUpJobData {
  appointmentId: string;
}

export interface UnreadMessageJobData {
  messageId: string;
  recipientId: string;
}

export interface IntakeReminderJobData {
  appointmentId: string;
}

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'sendAppointmentReminder':
        await this.sendAppointmentReminder(job.data as ReminderJobData);
        break;
      case 'sendFollowUpEmail':
        await this.sendFollowUpEmail(job.data as FollowUpJobData);
        break;
      case 'sendUnreadMessageEmail':
        await this.sendUnreadMessageEmail(job.data as UnreadMessageJobData);
        break;
      case 'sendIntakeFormReminder':
        await this.sendIntakeFormReminder(job.data as IntakeReminderJobData);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Handles 3 reminder subtypes: EMAIL_24H, EMAIL_1H, VIDEO_ROOM_READY.
   * Checks appointment is still CONFIRMED before sending.
   */
  private async sendAppointmentReminder(data: ReminderJobData): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: {
        patient: true,
        provider_profile: { include: { user: true } },
        service: true,
        practice: true,
      },
    });

    if (!appointment || appointment.status !== 'CONFIRMED') {
      this.logger.log(
        `Skipping reminder for appointment ${data.appointmentId} — not CONFIRMED`,
      );
      return;
    }

    // Update reminder record as sent
    await this.prisma.appointmentReminder.updateMany({
      where: {
        appointment_id: data.appointmentId,
        type: data.type,
        sent_at: null,
      },
      data: { sent_at: new Date() },
    });

    if (data.type === 'VIDEO_ROOM_READY') {
      // Create in-app notification instead of email
      await this.prisma.notification.create({
        data: {
          user_id: appointment.patient_id,
          practice_id: appointment.practice_id,
          type: 'VIDEO_ROOM_READY',
          title: 'Video Room Ready',
          body: `Your video appointment with ${appointment.provider_profile.user.name} is starting soon.`,
          data: { appointmentId: appointment.id } as any,
        },
      });
      this.logger.log(
        `VIDEO_ROOM_READY notification created for appointment ${data.appointmentId}`,
      );
      return;
    }

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

    const templateFn =
      data.type === 'EMAIL_24H'
        ? appointmentReminder24hTemplate
        : appointmentReminder1hTemplate;

    const templateData = {
      practiceName: appointment.practice.name,
      patientName: appointment.patient.name,
      providerName: appointment.provider_profile.user.name,
      serviceName: appointment.service.name,
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      consultationType: appointment.consultation_type,
      detailUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/appointments/${appointment.id}`,
    };

    const template = templateFn(templateData);
    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(
      `Sent ${data.type} reminder for appointment ${data.appointmentId}`,
    );
  }

  /**
   * Sends follow-up email 24h after appointment COMPLETED.
   */
  private async sendFollowUpEmail(data: FollowUpJobData): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: {
        patient: true,
        provider_profile: { include: { user: true } },
        service: true,
        practice: true,
      },
    });

    if (!appointment || appointment.status !== 'COMPLETED') {
      this.logger.log(
        `Skipping follow-up for appointment ${data.appointmentId} — not COMPLETED`,
      );
      return;
    }

    const template = appointmentFollowUpTemplate({
      practiceName: appointment.practice.name,
      patientName: appointment.patient.name,
      providerName: appointment.provider_profile.user.name,
      serviceName: appointment.service.name,
      rebookUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/book/${appointment.practice.slug}`,
    });

    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Sent follow-up email for appointment ${data.appointmentId}`);
  }

  /**
   * Sends email for messages unread after 5 minutes.
   * Checks message still exists and is unread before sending.
   */
  private async sendUnreadMessageEmail(data: UnreadMessageJobData): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: data.messageId },
      include: {
        sender: true,
        appointment: { include: { practice: true } },
      },
    });

    if (!message || message.read_at) {
      this.logger.log(
        `Skipping unread message email — message ${data.messageId} read or deleted`,
      );
      return;
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: data.recipientId },
    });

    if (!recipient) return;

    const template = unreadMessageTemplate({
      practiceName: message.appointment?.practice?.name || 'MedConnect',
      recipientName: recipient.name,
      senderName: message.sender?.name || 'System',
      messagePreview:
        message.content.length > 200
          ? message.content.slice(0, 200) + '...'
          : message.content,
      inboxUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/messages`,
    });

    await this.email.send({
      to: recipient.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Sent unread message email to ${recipient.email}`);
  }

  /**
   * Sends intake form reminder 24h before appointment if form not completed.
   */
  private async sendIntakeFormReminder(data: IntakeReminderJobData): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: {
        patient: true,
        service: true,
        practice: true,
        intake_submission: true,
      },
    });

    if (!appointment || appointment.status !== 'CONFIRMED') {
      this.logger.log(
        `Skipping intake reminder for ${data.appointmentId} — not CONFIRMED`,
      );
      return;
    }

    // Skip if intake already completed
    if (appointment.intake_submission?.status === 'COMPLETED') {
      this.logger.log(
        `Skipping intake reminder for ${data.appointmentId} — already completed`,
      );
      return;
    }

    const startTime = appointment.start_time;
    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const template = intakeFormReminderTemplate({
      practiceName: appointment.practice.name,
      patientName: appointment.patient.name,
      serviceName: appointment.service.name,
      appointmentDate: dateStr,
      intakeUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/appointments/${appointment.id}/intake`,
    });

    await this.email.send({
      to: appointment.patient.email,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Sent intake form reminder for appointment ${data.appointmentId}`);
  }
}
