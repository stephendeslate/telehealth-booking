import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { IntakeService } from './intake/intake.service';
import { NotificationsService } from './notifications/notifications.service';
import { MessagingService } from './messaging/messaging.service';
import { EmailService } from '../jobs/email.service';
import { getJwtKeyPair } from './auth/jwt-keys';
import {
  createTestUser,
  createTestPractice,
  createTestMembership,
  createTestProvider,
  createTestService,
  createTestAvailabilityRule,
  createTestAppointment,
  resetFactoryCounter,
} from '../../test/factories';

// Mock BullMQ Queue for MessagingService
const mockQueueAdd = vi.fn().mockResolvedValue({});
const mockQueue = { add: mockQueueAdd };

let module: TestingModule;
let prisma: PrismaService;
let intakeService: IntakeService;
let notificationsService: NotificationsService;
let messagingService: MessagingService;

async function cleanDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      messages, intake_submissions, intake_form_templates,
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

  await createTestAvailabilityRule(prisma, {
    practiceId: practice.id,
    providerProfileId: provider.id,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
  });

  // Create intake template for the service
  const template = await prisma.intakeFormTemplate.create({
    data: {
      practice_id: practice.id,
      name: 'Test Template',
      fields: [
        { id: 'chief_complaint', type: 'TEXTAREA', label: 'Chief Complaint', required: true },
      ],
      is_system: false,
      is_active: true,
    },
  });

  const service = await createTestService(prisma, {
    practiceId: practice.id,
    providerProfileIds: [provider.id],
    maxParticipants: 1,
  });

  // Link intake template to service
  await prisma.service.update({
    where: { id: service.id },
    data: { intake_form_template_id: template.id },
  });

  // Create an appointment
  const now = new Date();
  const daysUntilMonday = ((1 - now.getUTCDay() + 7) % 7) || 7;
  const future = new Date(now);
  future.setUTCDate(now.getUTCDate() + daysUntilMonday + 7);
  future.setUTCHours(10, 0, 0, 0);
  const endTime = new Date(future);
  endTime.setUTCMinutes(endTime.getUTCMinutes() + 30);

  const appointment = await createTestAppointment(prisma, {
    practiceId: practice.id,
    providerProfileId: provider.id,
    patientId: patient.id,
    serviceId: service.id,
    startTime: future,
    endTime,
    status: 'CONFIRMED',
  });

  return { owner, patient, practice, provider, service, template, appointment };
}

// ─── Module setup ────────────────────────

beforeAll(async () => {
  const keys = getJwtKeyPair();

  module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
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
      IntakeService,
      NotificationsService,
      {
        provide: MessagingService,
        useFactory: (prisma: PrismaService) => {
          return new MessagingService(prisma, mockQueue as any);
        },
        inject: [PrismaService],
      },
    ],
  }).compile();

  prisma = module.get(PrismaService);
  intakeService = module.get(IntakeService);
  notificationsService = module.get(NotificationsService);
  messagingService = module.get(MessagingService);
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  resetFactoryCounter();
  mockQueueAdd.mockClear();
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await prisma.$disconnect();
  await module.close();
});

// ─── Intake Forms ────────────────────────

describe('Intake Forms', () => {
  it('should create system presets for a practice', async () => {
    const practice = await createTestPractice(prisma);
    await intakeService.createSystemPresets(practice.id);

    const templates = await intakeService.listTemplates(practice.id);
    expect(templates).toHaveLength(3);
    expect(templates.every((t) => t.is_system)).toBe(true);

    const names = templates.map((t) => t.name);
    expect(names).toContain('General Health Intake');
    expect(names).toContain('Dental Intake');
    expect(names).toContain('Mental Health Intake');
  });

  it('should create, list, get, and update a custom template', async () => {
    const { owner, practice } = await setupTestContext();

    const created = await intakeService.createTemplate(
      practice.id,
      {
        name: 'Custom Template',
        fields: [
          { id: 'q1', type: 'TEXT' as any, label: 'Question 1', required: true },
        ],
      },
      owner.id,
    );

    expect(created.name).toBe('Custom Template');
    expect(created.is_system).toBe(false);

    const list = await intakeService.listTemplates(practice.id);
    expect(list.find((t) => t.id === created.id)).toBeTruthy();

    const fetched = await intakeService.getTemplate(practice.id, created.id);
    expect(fetched.id).toBe(created.id);

    const updated = await intakeService.updateTemplate(
      practice.id,
      created.id,
      { name: 'Updated Template' },
      owner.id,
    );
    expect(updated.name).toBe('Updated Template');
  });

  it('should prevent modifying system templates', async () => {
    const practice = await createTestPractice(prisma);
    await intakeService.createSystemPresets(practice.id);
    const templates = await intakeService.listTemplates(practice.id);
    const systemTemplate = templates[0];

    await expect(
      intakeService.updateTemplate(practice.id, systemTemplate.id, { name: 'Hacked' }, 'some-user'),
    ).rejects.toThrow('System templates cannot be modified');
  });

  it('should submit intake form for an appointment', async () => {
    const { patient, practice, appointment } = await setupTestContext();

    const submission = await intakeService.submitIntake(
      practice.id,
      appointment.id,
      { form_data: { chief_complaint: 'Headache and dizziness' } },
      patient.id,
    );

    expect(submission.status).toBe('COMPLETED');
    expect(submission.completed_at).toBeTruthy();
    expect((submission.form_data as any).chief_complaint).toBe('Headache and dizziness');
  });

  it('should reject duplicate intake submission', async () => {
    const { patient, practice, appointment } = await setupTestContext();

    await intakeService.submitIntake(
      practice.id,
      appointment.id,
      { form_data: { chief_complaint: 'Test' } },
      patient.id,
    );

    await expect(
      intakeService.submitIntake(
        practice.id,
        appointment.id,
        { form_data: { chief_complaint: 'Test 2' } },
        patient.id,
      ),
    ).rejects.toThrow('already completed');
  });

  it('should get intake submission', async () => {
    const { patient, practice, appointment } = await setupTestContext();

    // Before submission
    const before = await intakeService.getSubmission(practice.id, appointment.id);
    expect(before).toBeNull();

    // After submission
    await intakeService.submitIntake(
      practice.id,
      appointment.id,
      { form_data: { chief_complaint: 'Test' } },
      patient.id,
    );

    const after = await intakeService.getSubmission(practice.id, appointment.id);
    expect(after).toBeTruthy();
    expect(after!.status).toBe('COMPLETED');
    expect(after!.template).toBeTruthy();
  });
});

// ─── Notifications ────────────────────────

describe('Notifications', () => {
  it('should create, list, and paginate notifications', async () => {
    const user = await createTestUser(prisma);

    // Create 5 notifications
    for (let i = 0; i < 5; i++) {
      await notificationsService.create({
        user_id: user.id,
        type: 'APPOINTMENT_CONFIRMED',
        title: `Notification ${i}`,
        body: `Body ${i}`,
      });
    }

    const result = await notificationsService.list(user.id, { page: 1, limit: 3 });
    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(2);

    const page2 = await notificationsService.list(user.id, { page: 2, limit: 3 });
    expect(page2.data).toHaveLength(2);
  });

  it('should filter unread notifications', async () => {
    const user = await createTestUser(prisma);

    const n1 = await notificationsService.create({
      user_id: user.id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Read',
      body: 'Body',
    });
    await notificationsService.create({
      user_id: user.id,
      type: 'NEW_MESSAGE',
      title: 'Unread',
      body: 'Body',
    });

    // Mark first as read
    await notificationsService.markRead(user.id, n1.id);

    const unread = await notificationsService.list(user.id, { unread_only: true });
    expect(unread.data).toHaveLength(1);
    expect(unread.data[0].title).toBe('Unread');
  });

  it('should mark single notification as read', async () => {
    const user = await createTestUser(prisma);
    const notification = await notificationsService.create({
      user_id: user.id,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Test',
      body: 'Body',
    });

    const updated = await notificationsService.markRead(user.id, notification.id);
    expect(updated.read_at).toBeTruthy();
  });

  it('should mark all notifications as read', async () => {
    const user = await createTestUser(prisma);

    for (let i = 0; i < 3; i++) {
      await notificationsService.create({
        user_id: user.id,
        type: 'APPOINTMENT_CONFIRMED',
        title: `N${i}`,
        body: 'Body',
      });
    }

    const result = await notificationsService.markAllRead(user.id);
    expect(result.marked).toBe(3);

    const unread = await notificationsService.getUnreadCount(user.id);
    expect(unread).toBe(0);
  });

  it('should not mark another user\'s notifications', async () => {
    const user1 = await createTestUser(prisma);
    const user2 = await createTestUser(prisma);

    const notification = await notificationsService.create({
      user_id: user1.id,
      type: 'NEW_MESSAGE',
      title: 'Test',
      body: 'Body',
    });

    await expect(
      notificationsService.markRead(user2.id, notification.id),
    ).rejects.toThrow('not found');
  });
});

// ─── Messaging ────────────────────────

describe('Messaging', () => {
  it('should send a message from patient', async () => {
    const { patient, appointment } = await setupTestContext();

    const message = await messagingService.sendMessage(
      { appointment_id: appointment.id, content: 'Hello doctor!' },
      patient.id,
    );

    expect(message.content).toBe('Hello doctor!');
    expect(message.type).toBe('TEXT');
    expect(message.sender_id).toBe(patient.id);
    expect(message.appointment_id).toBe(appointment.id);

    // Should schedule unread email notification
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'sendUnreadMessageEmail',
      expect.objectContaining({ messageId: message.id }),
      expect.objectContaining({ delay: 5 * 60 * 1000 }),
    );
  });

  it('should send a message from provider', async () => {
    const { owner, appointment } = await setupTestContext();

    const message = await messagingService.sendMessage(
      { appointment_id: appointment.id, content: 'Hi patient!' },
      owner.id,
    );

    expect(message.sender_id).toBe(owner.id);
  });

  it('should reject messages to cancelled appointments', async () => {
    const { patient, practice, provider, service } = await setupTestContext();

    const now = new Date();
    const endTime = new Date(now.getTime() + 30 * 60 * 1000);
    const cancelledAppt = await createTestAppointment(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      patientId: patient.id,
      serviceId: service.id,
      startTime: now,
      endTime,
      status: 'CANCELLED',
    });

    await expect(
      messagingService.sendMessage(
        { appointment_id: cancelledAppt.id, content: 'Hello' },
        patient.id,
      ),
    ).rejects.toThrow('cancelled');
  });

  it('should list messages for an appointment', async () => {
    const { patient, owner, appointment } = await setupTestContext();

    await messagingService.sendMessage(
      { appointment_id: appointment.id, content: 'Message 1' },
      patient.id,
    );
    await messagingService.sendMessage(
      { appointment_id: appointment.id, content: 'Message 2' },
      owner.id,
    );

    const result = await messagingService.listMessages(appointment.id, patient.id, {});
    expect(result.data).toHaveLength(2);
    expect(result.data[0].content).toBe('Message 1');
    expect(result.data[1].content).toBe('Message 2');
  });

  it('should mark message as read', async () => {
    const { patient, owner, appointment } = await setupTestContext();

    const message = await messagingService.sendMessage(
      { appointment_id: appointment.id, content: 'Hello' },
      patient.id,
    );

    // Provider (recipient) marks as read
    const read = await messagingService.markRead(message.id, owner.id);
    expect(read.read_at).toBeTruthy();
  });

  it('should create system messages', async () => {
    const { appointment } = await setupTestContext();

    const sysMsg = await messagingService.createSystemMessage(
      appointment.id,
      'Intake form completed.',
    );

    expect(sysMsg).toBeTruthy();
    expect(sysMsg!.type).toBe('SYSTEM');
    expect(sysMsg!.sender_id).toBeNull();
  });

  it('should reject non-participant messages', async () => {
    const { appointment } = await setupTestContext();
    const outsider = await createTestUser(prisma);

    await expect(
      messagingService.sendMessage(
        { appointment_id: appointment.id, content: 'Spy!' },
        outsider.id,
      ),
    ).rejects.toThrow('Not a participant');
  });
});
