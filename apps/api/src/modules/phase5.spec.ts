import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { EmailService } from '../jobs/email.service';
import { SchedulingProcessor } from '../jobs/processors/scheduling.processor';
import { AppointmentsProcessor } from '../jobs/processors/appointments.processor';
import { NotificationsProcessor } from '../jobs/processors/notifications.processor';
import { AppointmentEventsHandler } from '../jobs/appointment-events.handler';
import {
  appointmentConfirmedTemplate,
  appointmentCancelledTemplate,
  appointmentRescheduledTemplate,
  appointmentReminder24hTemplate,
  appointmentReminder1hTemplate,
  appointmentFollowUpTemplate,
  intakeFormLinkTemplate,
  intakeFormReminderTemplate,
  paymentReceiptTemplate,
  paymentRefundTemplate,
  providerInvitationTemplate,
  unreadMessageTemplate,
  dataExportReadyTemplate,
  verifyEmailTemplate,
  passwordResetTemplate,
  welcomeTemplate,
} from '../jobs/email-templates';
import { getJwtKeyPair } from './auth/jwt-keys';
import {
  createTestUser,
  createTestPractice,
  createTestMembership,
  createTestProvider,
  createTestService,
  createTestAvailabilityRule,
  resetFactoryCounter,
} from '../../test/factories';
import { Job } from 'bullmq';

let module: TestingModule;
let prisma: PrismaService;
let emailService: EmailService;
let schedulingProcessor: SchedulingProcessor;
let appointmentsProcessor: AppointmentsProcessor;
let notificationsProcessor: NotificationsProcessor;

async function cleanDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      appointment_reminders, payment_records,
      slot_reservations, appointments,
      service_providers, services,
      blocked_dates, availability_rules,
      invitation_tokens, audit_logs,
      notifications,
      provider_profiles, tenant_memberships,
      refresh_tokens, consent_records,
      practices, users
    CASCADE
  `);
}

async function setupTestContext() {
  const owner = await createTestUser(prisma, { role: 'USER' });
  const patient = await createTestUser(prisma, { role: 'USER' });
  const practice = await createTestPractice(prisma);

  await createTestMembership(prisma, {
    practiceId: practice.id,
    userId: owner.id,
    role: 'OWNER',
  });

  const provider = await createTestProvider(prisma, {
    practiceId: practice.id,
    userId: owner.id,
  });

  const dayOfWeek = 1; // Monday
  await createTestAvailabilityRule(prisma, {
    practiceId: practice.id,
    providerProfileId: provider.id,
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
  });

  const service = await createTestService(prisma, {
    practiceId: practice.id,
    providerProfileIds: [provider.id],
    maxParticipants: 1,
  });

  // Create a future Monday date
  const now = new Date();
  const daysUntilMonday = ((1 - now.getUTCDay() + 7) % 7) || 7;
  const future = new Date(now);
  future.setUTCDate(now.getUTCDate() + daysUntilMonday + 7); // next-next Monday
  const futureDate = future.toISOString().split('T')[0];

  return { owner, patient, practice, provider, service, futureDate };
}

// ─── Module setup ────────────────────────

beforeAll(async () => {
  const keys = getJwtKeyPair();

  module = await Test.createTestingModule({
    imports: [
      EventEmitterModule.forRoot(),
      JwtModule.register({
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        signOptions: { algorithm: 'RS256', issuer: 'medconnect' },
        verifyOptions: { algorithms: ['RS256'], issuer: 'medconnect' },
      }),
    ],
    providers: [
      PrismaService,
      AuditService,
      EmailService,
      SchedulingProcessor,
      AppointmentsProcessor,
      NotificationsProcessor,
    ],
  }).compile();

  prisma = module.get(PrismaService);
  emailService = module.get(EmailService);
  schedulingProcessor = module.get(SchedulingProcessor);
  appointmentsProcessor = module.get(AppointmentsProcessor);
  notificationsProcessor = module.get(NotificationsProcessor);
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  resetFactoryCounter();
  emailService.clearSentEmails();
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await prisma.$disconnect();
  await module.close();
});

// ─── Email Templates ────────────────────────

describe('Email Templates', () => {
  const baseCtx = { practiceName: 'Test Practice' };

  it('should render all 16 email templates', () => {
    // 1. verify-email
    const t1 = verifyEmailTemplate({ ...baseCtx, userName: 'John', verifyUrl: 'https://example.com/verify' });
    expect(t1.subject).toContain('Verify');
    expect(t1.html).toContain('John');
    expect(t1.html).toContain('https://example.com/verify');

    // 2. password-reset
    const t2 = passwordResetTemplate({ ...baseCtx, userName: 'Jane', resetUrl: 'https://example.com/reset' });
    expect(t2.subject).toContain('Reset');
    expect(t2.html).toContain('Jane');

    // 3. welcome
    const t3 = welcomeTemplate({ ...baseCtx, userName: 'Sam', loginUrl: 'https://example.com/login' });
    expect(t3.subject).toContain('Welcome');

    // 4. appointment.confirmed
    const t4 = appointmentConfirmedTemplate({
      ...baseCtx,
      patientName: 'Pat',
      providerName: 'Dr. Smith',
      serviceName: 'Checkup',
      appointmentDate: 'Jan 1, 2026',
      appointmentTime: '10:00 AM',
      consultationType: 'VIDEO',
      detailUrl: 'https://example.com/appt/1',
    });
    expect(t4.subject).toContain('Confirmed');
    expect(t4.html).toContain('Dr. Smith');

    // 5. appointment.cancelled
    const t5 = appointmentCancelledTemplate({
      ...baseCtx,
      recipientName: 'Pat',
      serviceName: 'Checkup',
      appointmentDate: 'Jan 1',
      appointmentTime: '10:00 AM',
      cancelledBy: 'Dr. Smith',
      reason: 'Emergency',
      rebookUrl: 'https://example.com/rebook',
    });
    expect(t5.subject).toContain('Cancelled');
    expect(t5.html).toContain('Emergency');

    // 6. appointment.rescheduled
    const t6 = appointmentRescheduledTemplate({
      ...baseCtx,
      patientName: 'Pat',
      serviceName: 'Checkup',
      oldDate: 'Jan 1',
      oldTime: '10:00 AM',
      newDate: 'Jan 2',
      newTime: '2:00 PM',
      detailUrl: 'https://example.com/appt/1',
    });
    expect(t6.subject).toContain('Rescheduled');
    expect(t6.html).toContain('Jan 2');

    // 7. appointment.reminder-24h
    const t7 = appointmentReminder24hTemplate({
      ...baseCtx,
      patientName: 'Pat',
      providerName: 'Dr. Smith',
      serviceName: 'Checkup',
      appointmentDate: 'Jan 1',
      appointmentTime: '10:00 AM',
      detailUrl: 'https://example.com/appt/1',
    });
    expect(t7.subject).toContain('Reminder');
    expect(t7.subject).toContain('Tomorrow');

    // 8. appointment.reminder-1h
    const t8 = appointmentReminder1hTemplate({
      ...baseCtx,
      patientName: 'Pat',
      providerName: 'Dr. Smith',
      serviceName: 'Checkup',
      appointmentTime: '10:00 AM',
      consultationType: 'VIDEO',
      joinUrl: 'https://example.com/join',
      detailUrl: 'https://example.com/appt/1',
    });
    expect(t8.subject).toContain('Starting Soon');
    expect(t8.html).toContain('Join Video Call');

    // 9. appointment.follow-up
    const t9 = appointmentFollowUpTemplate({
      ...baseCtx,
      patientName: 'Pat',
      providerName: 'Dr. Smith',
      serviceName: 'Checkup',
      rebookUrl: 'https://example.com/rebook',
    });
    expect(t9.subject).toContain('How was');

    // 10. intake.form-link
    const t10 = intakeFormLinkTemplate({
      ...baseCtx,
      patientName: 'Pat',
      serviceName: 'Checkup',
      appointmentDate: 'Jan 1',
      intakeUrl: 'https://example.com/intake',
    });
    expect(t10.subject).toContain('intake form');

    // 11. intake.reminder
    const t11 = intakeFormReminderTemplate({
      ...baseCtx,
      patientName: 'Pat',
      serviceName: 'Checkup',
      appointmentDate: 'Jan 1',
      intakeUrl: 'https://example.com/intake',
    });
    expect(t11.subject).toContain('Reminder');

    // 12. payment.receipt
    const t12 = paymentReceiptTemplate({
      ...baseCtx,
      patientName: 'Pat',
      serviceName: 'Checkup',
      amount: '$100.00',
      currency: 'USD',
      paymentDate: 'Jan 1, 2026',
    });
    expect(t12.subject).toContain('Receipt');

    // 13. payment.refund
    const t13 = paymentRefundTemplate({
      ...baseCtx,
      patientName: 'Pat',
      serviceName: 'Checkup',
      refundAmount: '$50.00',
      currency: 'USD',
    });
    expect(t13.subject).toContain('Refund');

    // 14. provider.invitation
    const t14 = providerInvitationTemplate({
      ...baseCtx,
      inviteeName: 'Dr. Jones',
      inviterName: 'Admin',
      acceptUrl: 'https://example.com/accept',
    });
    expect(t14.subject).toContain('invited');

    // 15. message.unread
    const t15 = unreadMessageTemplate({
      ...baseCtx,
      recipientName: 'Pat',
      senderName: 'Dr. Smith',
      messagePreview: 'Hello, how are you feeling?',
      inboxUrl: 'https://example.com/messages',
    });
    expect(t15.subject).toContain('message');
    expect(t15.html).toContain('Hello, how are you feeling?');

    // 16. patient.data-export-ready
    const t16 = dataExportReadyTemplate({
      ...baseCtx,
      patientName: 'Pat',
      downloadUrl: 'https://example.com/download',
      expiresIn: '7 days',
    });
    expect(t16.subject).toContain('export');
  });

  it('should escape HTML in template variables', () => {
    const t = verifyEmailTemplate({
      ...baseCtx,
      userName: '<script>alert("xss")</script>',
      verifyUrl: 'https://example.com',
    });
    expect(t.html).not.toContain('<script>');
    expect(t.html).toContain('&lt;script&gt;');
  });

  it('should include demo banner in all templates', () => {
    const t = welcomeTemplate({
      ...baseCtx,
      userName: 'Test',
      loginUrl: 'https://example.com',
    });
    expect(t.html).toContain('demo application');
    expect(t.html).toContain('synthetic');
  });
});

// ─── Email Service ──────────────────────────

describe('EmailService', () => {
  it('should mock send and track sent emails', async () => {
    const result = await emailService.send({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    expect(result.id).toMatch(/^mock_/);
    expect(result.to).toBe('test@example.com');
    expect(emailService.getSentEmails()).toHaveLength(1);
  });

  it('should clear sent emails', async () => {
    await emailService.send({ to: 'a@b.com', subject: 'X', html: '' });
    expect(emailService.getSentEmails()).toHaveLength(1);
    emailService.clearSentEmails();
    expect(emailService.getSentEmails()).toHaveLength(0);
  });
});

// ─── Scheduling Processor ───────────────────

describe('SchedulingProcessor (cleanExpiredReservations)', () => {
  it('should delete expired slot reservations', async () => {
    const ctx = await setupTestContext();

    // Create an expired reservation
    await prisma.slotReservation.create({
      data: {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        start_time: new Date('2026-06-01T10:00:00Z'),
        end_time: new Date('2026-06-01T10:30:00Z'),
        session_id: 'sess_expired',
        expires_at: new Date(Date.now() - 60000), // expired 1 minute ago
      },
    });

    // Create a valid (not-expired) reservation
    await prisma.slotReservation.create({
      data: {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        start_time: new Date('2026-06-01T11:00:00Z'),
        end_time: new Date('2026-06-01T11:30:00Z'),
        session_id: 'sess_valid',
        expires_at: new Date(Date.now() + 600000), // expires in 10 minutes
      },
    });

    // Run the processor
    await schedulingProcessor.process({ name: 'cleanExpiredReservations' } as Job);

    const remaining = await prisma.slotReservation.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].session_id).toBe('sess_valid');
  });

  it('should handle no expired reservations gracefully', async () => {
    await schedulingProcessor.process({ name: 'cleanExpiredReservations' } as Job);
    // No error thrown
  });
});

// ─── Appointments Processor ─────────────────

describe('AppointmentsProcessor', () => {
  describe('processCompletedAppointments', () => {
    it('should auto-complete past IN_PERSON CONFIRMED appointments', async () => {
      const ctx = await setupTestContext();

      // Create an IN_PERSON appointment in the past, status CONFIRMED
      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          end_time: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
          status: 'CONFIRMED',
          consultation_type: 'IN_PERSON',
        },
      });

      await appointmentsProcessor.process({ name: 'processCompletedAppointments' } as Job);

      const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(updated!.status).toBe('COMPLETED');
    });

    it('should NOT auto-complete VIDEO appointments', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
          end_time: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      await appointmentsProcessor.process({ name: 'processCompletedAppointments' } as Job);

      const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(updated!.status).toBe('CONFIRMED'); // unchanged
    });
  });

  describe('detectNoShows', () => {
    it('should mark VIDEO appointments as NO_SHOW past end_time + 15min', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
          end_time: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago (> 15min threshold)
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      await appointmentsProcessor.process({ name: 'detectNoShows' } as Job);

      const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(updated!.status).toBe('NO_SHOW');
    });

    it('should NOT mark recent VIDEO appointments as NO_SHOW', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() - 30 * 60 * 1000),
          end_time: new Date(Date.now() - 5 * 60 * 1000), // only 5 min ago (< 15min threshold)
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      await appointmentsProcessor.process({ name: 'detectNoShows' } as Job);

      const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(updated!.status).toBe('CONFIRMED'); // unchanged
    });
  });

  describe('enforceApprovalDeadlines', () => {
    it('should auto-cancel PENDING appointments older than 48 hours', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // next week
          end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          status: 'PENDING',
          consultation_type: 'VIDEO',
          created_at: new Date(Date.now() - 49 * 60 * 60 * 1000), // 49 hours ago
        },
      });

      await appointmentsProcessor.process({ name: 'enforceApprovalDeadlines' } as Job);

      const updated = await prisma.appointment.findUnique({ where: { id: appt.id } });
      expect(updated!.status).toBe('CANCELLED');
      expect(updated!.cancellation_reason).toContain('Approval deadline');
    });

    it('should refund paid appointments when auto-cancelling', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          status: 'PENDING',
          consultation_type: 'VIDEO',
          created_at: new Date(Date.now() - 49 * 60 * 60 * 1000),
        },
      });

      // Create a payment record
      await prisma.paymentRecord.create({
        data: {
          practice_id: ctx.practice.id,
          appointment_id: appt.id,
          amount: 100,
          currency: 'USD',
          status: 'SUCCEEDED',
          stripe_payment_intent_id: 'pi_mock_test',
          platform_fee: 1,
        },
      });

      await appointmentsProcessor.process({ name: 'enforceApprovalDeadlines' } as Job);

      const payment = await prisma.paymentRecord.findFirst({
        where: { appointment_id: appt.id },
      });
      expect(payment!.status).toBe('REFUNDED');
    });
  });
});

// ─── Notifications Processor ────────────────

describe('NotificationsProcessor', () => {
  describe('sendAppointmentReminder', () => {
    it('should send EMAIL_24H reminder for CONFIRMED appointment', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      // Create reminder record
      await prisma.appointmentReminder.create({
        data: {
          practice_id: ctx.practice.id,
          appointment_id: appt.id,
          type: 'EMAIL_24H',
          scheduled_for: new Date(),
        },
      });

      await notificationsProcessor.process({
        name: 'sendAppointmentReminder',
        data: { appointmentId: appt.id, type: 'EMAIL_24H' },
      } as unknown as Job);

      const emails = emailService.getSentEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].to).toBe(ctx.patient.email);
      expect(emails[0].subject).toContain('Reminder');

      // Check reminder record was updated
      const reminder = await prisma.appointmentReminder.findFirst({
        where: { appointment_id: appt.id, type: 'EMAIL_24H' },
      });
      expect(reminder!.sent_at).not.toBeNull();
    });

    it('should skip reminder for non-CONFIRMED appointment', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          status: 'CANCELLED',
          consultation_type: 'VIDEO',
        },
      });

      await notificationsProcessor.process({
        name: 'sendAppointmentReminder',
        data: { appointmentId: appt.id, type: 'EMAIL_24H' },
      } as unknown as Job);

      expect(emailService.getSentEmails()).toHaveLength(0);
    });

    it('should create VIDEO_ROOM_READY notification instead of email', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 15 * 60 * 1000),
          end_time: new Date(Date.now() + 45 * 60 * 1000),
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      await prisma.appointmentReminder.create({
        data: {
          practice_id: ctx.practice.id,
          appointment_id: appt.id,
          type: 'VIDEO_ROOM_READY',
          scheduled_for: new Date(),
        },
      });

      await notificationsProcessor.process({
        name: 'sendAppointmentReminder',
        data: { appointmentId: appt.id, type: 'VIDEO_ROOM_READY' },
      } as unknown as Job);

      // Should create notification, not send email
      expect(emailService.getSentEmails()).toHaveLength(0);

      const notification = await prisma.notification.findFirst({
        where: { user_id: ctx.patient.id, type: 'VIDEO_ROOM_READY' },
      });
      expect(notification).not.toBeNull();
      expect(notification!.title).toBe('Video Room Ready');
    });
  });

  describe('sendFollowUpEmail', () => {
    it('should send follow-up email for COMPLETED appointment', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() - 48 * 60 * 60 * 1000),
          end_time: new Date(Date.now() - 47.5 * 60 * 60 * 1000),
          status: 'COMPLETED',
          consultation_type: 'VIDEO',
        },
      });

      await notificationsProcessor.process({
        name: 'sendFollowUpEmail',
        data: { appointmentId: appt.id },
      } as unknown as Job);

      const emails = emailService.getSentEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].subject).toContain('How was');
    });

    it('should skip follow-up for non-COMPLETED appointment', async () => {
      const ctx = await setupTestContext();

      const appt = await prisma.appointment.create({
        data: {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          patient_id: ctx.patient.id,
          service_id: ctx.service.id,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
        },
      });

      await notificationsProcessor.process({
        name: 'sendFollowUpEmail',
        data: { appointmentId: appt.id },
      } as unknown as Job);

      expect(emailService.getSentEmails()).toHaveLength(0);
    });
  });
});
