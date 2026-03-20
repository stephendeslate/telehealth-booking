import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { VideoService } from './video/video.service';
import { PaymentService } from './payments/payment.service';
import { CalendarService } from './calendar/calendar.service';
import { AdminService } from './admin/admin.service';
import { UploadService } from './uploads/upload.service';
import { MockVideoProvider } from './video/mock-video.provider';
import { VIDEO_PROVIDER } from './video/video-provider.interface';
import { getJwtKeyPair } from './auth/jwt-keys';
import { PLATFORM_FEE_PERCENT, UPLOAD_LIMITS, UploadPurpose, CalendarProvider } from '@medconnect/shared';
import {
  createTestUser,
  createTestPractice,
  createTestMembership,
  createTestProvider,
  createTestService,
  createTestAppointment,
  createTestPaymentRecord,
  createTestVideoRoom,
  createTestCalendarConnection,
  resetFactoryCounter,
} from '../../test/factories';

// Mock BullMQ Queue
const mockQueueAdd = vi.fn().mockResolvedValue({});
const mockQueue = { add: mockQueueAdd };

let module: TestingModule;
let prisma: PrismaService;
let videoService: VideoService;
let paymentService: PaymentService;
let calendarService: CalendarService;
let adminService: AdminService;
let uploadService: UploadService;

async function cleanDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      video_participants, video_rooms,
      calendar_events, calendar_connections,
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

  const service = await createTestService(prisma, {
    practiceId: practice.id,
    providerProfileIds: [provider.id],
    price: 150,
  });

  const now = new Date();
  const startTime = new Date(now.getTime() + 3600 * 1000);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  const appointment = await createTestAppointment(prisma, {
    practiceId: practice.id,
    providerProfileId: provider.id,
    patientId: patient.id,
    serviceId: service.id,
    startTime,
    endTime,
    status: 'CONFIRMED',
    consultationType: 'VIDEO',
  });

  return { owner, patient, practice, provider, service, appointment };
}

beforeAll(async () => {
  const { privateKey, publicKey } = getJwtKeyPair();

  module = await Test.createTestingModule({
    imports: [
      EventEmitterModule.forRoot(),
      JwtModule.register({
        privateKey,
        publicKey,
        signOptions: { algorithm: 'RS256', expiresIn: '15m' },
      }),
    ],
    providers: [
      PrismaService,
      AuditService,
      VideoService,
      PaymentService,
      CalendarService,
      AdminService,
      UploadService,
      { provide: VIDEO_PROVIDER, useClass: MockVideoProvider },
      { provide: 'BullQueue_calendar', useValue: mockQueue },
      { provide: 'BullQueue_uploads', useValue: mockQueue },
      { provide: 'BullQueue_exports', useValue: mockQueue },
    ],
  }).compile();

  prisma = module.get(PrismaService);
  videoService = module.get(VideoService);
  paymentService = module.get(PaymentService);
  calendarService = module.get(CalendarService);
  adminService = module.get(AdminService);
  uploadService = module.get(UploadService);
});

afterAll(async () => {
  await module.close();
});

beforeEach(async () => {
  resetFactoryCounter();
  mockQueueAdd.mockClear();
  await cleanDb();
});

// ─── VIDEO SERVICE ─────────────────────────────────────────────────

describe('VideoService', () => {
  it('should create a video room for a VIDEO appointment', async () => {
    const { appointment } = await setupTestContext();

    const room = await videoService.createRoom(appointment.id);

    expect(room).toBeDefined();
    expect(room.appointment_id).toBe(appointment.id);
    expect(room.status).toBe('CREATED');
    expect(room.twilio_room_sid).toMatch(/^RM/);
    expect(room.twilio_room_name).toContain('appt_');
  });

  it('should return existing room on duplicate create', async () => {
    const { appointment } = await setupTestContext();

    const room1 = await videoService.createRoom(appointment.id);
    const room2 = await videoService.createRoom(appointment.id);

    expect(room2.id).toBe(room1.id);
  });

  it('should generate a token for a participant', async () => {
    const { appointment, patient } = await setupTestContext();

    const result = await videoService.generateToken(appointment.id, patient.id);

    expect(result.token).toMatch(/^mock_token_/);
    expect(result.room_name).toBeDefined();
    expect(result.expires_at).toBeDefined();
  });

  it('should reject token generation for non-participants', async () => {
    const { appointment } = await setupTestContext();
    const outsider = await createTestUser(prisma, { role: 'USER' });

    await expect(
      videoService.generateToken(appointment.id, outsider.id),
    ).rejects.toThrow('Not a participant');
  });

  it('should end a video room', async () => {
    const { appointment, owner } = await setupTestContext();
    await videoService.createRoom(appointment.id);

    const ended = await videoService.endRoom(appointment.id, owner.id);

    expect(ended.status).toBe('COMPLETED');
    expect(ended.ended_at).toBeDefined();
  });

  it('should clean up overdue rooms', async () => {
    const { practice, provider, patient, service } = await setupTestContext();

    // Create a past appointment with a room
    const pastStart = new Date(Date.now() - 120 * 60 * 1000); // 2 hours ago
    const pastEnd = new Date(Date.now() - 90 * 60 * 1000); // 1.5 hours ago (past 30min limit)
    const pastAppt = await createTestAppointment(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      patientId: patient.id,
      serviceId: service.id,
      startTime: pastStart,
      endTime: pastEnd,
      status: 'CONFIRMED',
      consultationType: 'VIDEO',
    });

    await createTestVideoRoom(prisma, {
      practiceId: practice.id,
      appointmentId: pastAppt.id,
      status: 'IN_PROGRESS',
    });

    const result = await videoService.cleanupRooms();
    expect(result.ended).toBe(1);
  });
});

// ─── PAYMENT SERVICE ───────────────────────────────────────────────

describe('PaymentService', () => {
  it('should create a payment intent with platform fee', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    const payment = await paymentService.createPaymentIntent({
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 15000, // $150.00 in cents
      userId: owner.id,
    });

    expect(payment).toBeDefined();
    expect(payment.amount).toBe(15000);
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.stripe_payment_intent_id).toMatch(/^pi_mock_/);
    expect(payment.platform_fee).toBe(
      Math.round(15000 * PLATFORM_FEE_PERCENT) / 100,
    );
  });

  it('should process a full refund', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    const payment = await paymentService.createPaymentIntent({
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 10000,
      userId: owner.id,
    });

    const refunded = await paymentService.refund({
      paymentId: payment.id,
      userId: owner.id,
    });

    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refund_amount).toBe(10000);
  });

  it('should process a partial refund', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    const payment = await paymentService.createPaymentIntent({
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 10000,
      userId: owner.id,
    });

    const refunded = await paymentService.refund({
      paymentId: payment.id,
      amount: 5000,
      userId: owner.id,
    });

    expect(refunded.status).toBe('PARTIALLY_REFUNDED');
    expect(refunded.refund_amount).toBe(5000);
  });

  it('should get payment by appointment', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    await paymentService.createPaymentIntent({
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 10000,
      userId: owner.id,
    });

    const found = await paymentService.getByAppointment(appointment.id);
    expect(found).toBeDefined();
    expect(found!.appointment_id).toBe(appointment.id);
  });

  it('should list payments for a practice', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    await paymentService.createPaymentIntent({
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 10000,
      userId: owner.id,
    });

    const result = await paymentService.listForPractice(practice.id);
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
  });
});

// ─── CALENDAR SERVICE ──────────────────────────────────────────────

describe('CalendarService', () => {
  it('should connect a calendar', async () => {
    const { provider, owner } = await setupTestContext();

    const connection = await calendarService.connect({
      providerProfileId: provider.id,
      provider: CalendarProvider.GOOGLE,
      authCode: 'mock_auth_code',
      redirectUri: 'http://localhost:3000/callback',
      userId: owner.id,
    });

    expect(connection).toBeDefined();
    expect(connection.provider).toBe('GOOGLE');
    expect(connection.status).toBe('ACTIVE');
  });

  it('should disconnect a calendar', async () => {
    const { provider, owner } = await setupTestContext();

    const connection = await calendarService.connect({
      providerProfileId: provider.id,
      provider: CalendarProvider.GOOGLE,
      authCode: 'mock_auth_code',
      redirectUri: 'http://localhost:3000/callback',
      userId: owner.id,
    });

    const disconnected = await calendarService.disconnect(connection.id, owner.id);
    expect(disconnected.status).toBe('DISCONNECTED');
  });

  it('should get calendar connection status', async () => {
    const { provider, owner } = await setupTestContext();

    await calendarService.connect({
      providerProfileId: provider.id,
      provider: CalendarProvider.GOOGLE,
      authCode: 'mock_auth_code',
      redirectUri: 'http://localhost:3000/callback',
      userId: owner.id,
    });

    const connections = await calendarService.getStatus(provider.id);
    expect(connections.length).toBe(1);
    expect(connections[0].provider).toBe('GOOGLE');
  });

  it('should queue a calendar event push', async () => {
    const { appointment } = await setupTestContext();

    await calendarService.pushEvent(appointment.id);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'calendarEventPush',
      { appointmentId: appointment.id },
      expect.any(Object),
    );
  });

  it('should perform inbound sync', async () => {
    const { provider, owner } = await setupTestContext();

    await calendarService.connect({
      providerProfileId: provider.id,
      provider: CalendarProvider.GOOGLE,
      authCode: 'mock',
      redirectUri: 'http://localhost:3000/callback',
      userId: owner.id,
    });

    const result = await calendarService.inboundSync();
    expect(result.synced).toBe(1);
  });
});

// ─── ADMIN SERVICE ─────────────────────────────────────────────────

describe('AdminService', () => {
  it('should return practice analytics', async () => {
    const { practice, appointment, owner } = await setupTestContext();

    // Create a payment
    await createTestPaymentRecord(prisma, {
      practiceId: practice.id,
      appointmentId: appointment.id,
      amount: 15000,
    });

    const analytics = await adminService.getAnalytics(practice.id);

    expect(analytics.total_appointments).toBe(1);
    expect(analytics.total_revenue).toBe(15000);
    expect(analytics.total_patients).toBe(1);
  });

  it('should list patients for a practice', async () => {
    const { practice } = await setupTestContext();

    const result = await adminService.listPatients(practice.id);
    expect(result.data.length).toBe(1); // The patient from setupTestContext
    expect(result.total).toBe(1);
  });

  it('should search patients', async () => {
    const { practice } = await setupTestContext();

    const result = await adminService.listPatients(practice.id, {
      search: 'nonexistent',
    });
    expect(result.data.length).toBe(0);
  });

  it('should list payments for a practice', async () => {
    const { practice, appointment } = await setupTestContext();

    await createTestPaymentRecord(prisma, {
      practiceId: practice.id,
      appointmentId: appointment.id,
    });

    const result = await adminService.listPayments(practice.id);
    expect(result.data.length).toBe(1);
    expect(result.data[0].amount).toBe(100);
  });
});

// ─── UPLOAD SERVICE ────────────────────────────────────────────────

describe('UploadService', () => {
  it('should generate a presigned upload URL', async () => {
    const { owner } = await setupTestContext();

    const result = await uploadService.presignUpload({
      purpose: UploadPurpose.AVATAR,
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      contentLength: 500000,
      userId: owner.id,
    });

    expect(result.upload_url).toContain('mock-r2');
    expect(result.public_url).toContain('mock-r2');
    expect(result.expires_at).toBeDefined();
  });

  it('should reject files that are too large', async () => {
    const { owner } = await setupTestContext();

    await expect(
      uploadService.presignUpload({
        purpose: UploadPurpose.AVATAR,
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
        contentLength: UPLOAD_LIMITS.avatar + 1,
        userId: owner.id,
      }),
    ).rejects.toThrow('File too large');
  });

  it('should reject invalid MIME types', async () => {
    const { owner } = await setupTestContext();

    await expect(
      uploadService.presignUpload({
        purpose: UploadPurpose.AVATAR,
        filename: 'file.pdf',
        contentType: 'application/pdf',
        contentLength: 500000,
        userId: owner.id,
      }),
    ).rejects.toThrow('Invalid content type');
  });

  it('should schedule orphaned upload cleanup', async () => {
    const { owner } = await setupTestContext();

    await uploadService.presignUpload({
      purpose: UploadPurpose.AVATAR,
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      contentLength: 500000,
      userId: owner.id,
    });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'deleteOrphanedUpload',
      expect.objectContaining({ userId: owner.id }),
      expect.any(Object),
    );
  });

  it('should request data export', async () => {
    const { owner } = await setupTestContext();

    const result = await uploadService.requestDataExport(owner.id);
    expect(result.status).toBe('queued');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generatePatientDataExport',
      { userId: owner.id },
      expect.any(Object),
    );
  });

  it('should rate limit data exports', async () => {
    const { owner } = await setupTestContext();

    await uploadService.requestDataExport(owner.id);

    await expect(
      uploadService.requestDataExport(owner.id),
    ).rejects.toThrow('rate limited');
  });
});
