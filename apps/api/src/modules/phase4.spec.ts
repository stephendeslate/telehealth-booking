import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { ProvidersService } from './providers/providers.service';
import { AvailabilityService } from './providers/availability.service';
import { AppointmentsService } from './appointments/appointments.service';
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
import { randomBytes } from 'crypto';
import {
  SlotNoLongerAvailableError,
  SlotTemporarilyHeldError,
  InvalidAppointmentTransitionError,
  NotFoundError,
  ForbiddenError,
} from '../common/errors/app-error';

let module: TestingModule;
let prisma: PrismaService;
let appointments: AppointmentsService;

async function cleanDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      payment_records, slot_reservations, appointments,
      service_providers, services,
      blocked_dates, availability_rules,
      invitation_tokens, audit_logs,
      provider_profiles, tenant_memberships,
      refresh_tokens, consent_records, notifications,
      practices, users
    CASCADE
  `);
}

/**
 * Get a future date string (YYYY-MM-DD) that falls on a specific day of week (UTC).
 * dayOfWeek: 0=Sunday..6=Saturday
 */
function getFutureDate(daysAhead: number, dayOfWeek?: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  if (dayOfWeek !== undefined) {
    while (d.getUTCDay() !== dayOfWeek) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return d.toISOString().split('T')[0]!;
}

/** Build a full ISO datetime from a date + time */
function dateTime(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00.000Z`;
}

// ─── Inline factories (workaround for SWC cache issue with test/factories.ts) ──

async function createTestAppointment(
  p: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    patientId: string;
    serviceId: string;
    startTime: Date;
    endTime: Date;
    status?: string;
    consultationType?: string;
  },
) {
  return p.appointment.create({
    data: {
      practice_id: opts.practiceId,
      provider_profile_id: opts.providerProfileId,
      patient_id: opts.patientId,
      service_id: opts.serviceId,
      start_time: opts.startTime,
      end_time: opts.endTime,
      status: (opts.status || 'CONFIRMED') as any,
      consultation_type: (opts.consultationType || 'VIDEO') as any,
    },
  });
}

async function createTestSlotReservation(
  p: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    startTime: Date;
    endTime: Date;
    sessionId?: string;
    expiresAt?: Date;
  },
) {
  return p.slotReservation.create({
    data: {
      practice_id: opts.practiceId,
      provider_profile_id: opts.providerProfileId,
      start_time: opts.startTime,
      end_time: opts.endTime,
      session_id: opts.sessionId || `sess_${randomBytes(16).toString('hex')}`,
      expires_at: opts.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

// ─── Shared test context ────────────────────────

interface TestContext {
  owner: any;
  patient: any;
  practice: any;
  provider: any;
  service: any;
  futureDate: string; // YYYY-MM-DD on a Monday
}

async function setupTestContext(): Promise<TestContext> {
  const owner = await createTestUser(prisma, { email: 'owner@phase4.test' });
  const patient = await createTestUser(prisma, { email: 'patient@phase4.test' });
  const practice = await createTestPractice(prisma, { slug: 'phase4-test' });
  await createTestMembership(prisma, {
    practiceId: practice.id,
    userId: owner.id,
    role: 'OWNER',
  });
  const provider = await createTestProvider(prisma, {
    practiceId: practice.id,
    userId: owner.id,
  });

  // Find the next Monday (dayOfWeek=1)
  const futureDate = getFutureDate(7, 1);

  // Create availability rule for Mondays 09:00-17:00 UTC
  await createTestAvailabilityRule(prisma, {
    practiceId: practice.id,
    providerProfileId: provider.id,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
  });

  const service = await createTestService(prisma, {
    practiceId: practice.id,
    providerProfileIds: [provider.id],
    name: 'Consultation',
    durationMinutes: 30,
    price: 10000, // $100
  });

  // Ensure max_participants is 1 for standard 1:1 consultations
  await prisma.service.update({
    where: { id: service.id },
    data: { max_participants: 1 },
  });
  service.max_participants = 1;

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
      ProvidersService,
      AvailabilityService,
      AppointmentsService,
    ],
  }).compile();

  prisma = module.get(PrismaService);
  appointments = module.get(AppointmentsService);
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  resetFactoryCounter();
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await prisma.$disconnect();
  await module.close();
});

// ─── Slot Reservation ────────────────────────

describe('Slot Reservation', () => {
  it('should reserve a slot and return session info', async () => {
    const ctx = await setupTestContext();

    const result = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: dateTime(ctx.futureDate, '09:00'),
    });

    expect(result.reservation_id).toBeDefined();
    expect(result.session_id).toMatch(/^sess_/);
    expect(result.start_time).toContain('09:00');
    expect(result.end_time).toContain('09:30');
    expect(result.expires_at).toBeDefined();
  });

  it('should reject reservation when slot is already reserved', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '10:00');

    await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    await expect(
      appointments.reserveSlot({
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
      }),
    ).rejects.toThrow(SlotTemporarilyHeldError);
  });

  it('should reject reservation when slot has a confirmed appointment', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '11:00'));

    await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    await expect(
      appointments.reserveSlot({
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime.toISOString(),
      }),
    ).rejects.toThrow(SlotNoLongerAvailableError);
  });

  it('should allow reservation when existing appointment is cancelled', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '12:00'));

    await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CANCELLED',
    });

    const result = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime.toISOString(),
    });

    expect(result.reservation_id).toBeDefined();
  });

  it('should reject reservation for non-existent service', async () => {
    const ctx = await setupTestContext();

    await expect(
      appointments.reserveSlot({
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: '00000000-0000-0000-0000-000000000000',
        start_time: dateTime(ctx.futureDate, '09:00'),
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Appointment Creation ────────────────────────

describe('Appointment Creation', () => {
  it('should create an appointment from a valid reservation', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '09:00');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
      '127.0.0.1',
      'test-agent',
    );

    expect(appt.id).toBeDefined();
    expect(appt.status).toBe('CONFIRMED'); // AUTO_CONFIRM default
    expect(appt.patient.id).toBe(ctx.patient.id);
    expect(appt.service.price).toBe(10000);
  });

  it('should delete the reservation after booking', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '09:30');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
    );

    const remaining = await prisma.slotReservation.findFirst({
      where: { session_id: reservation.session_id },
    });
    expect(remaining).toBeNull();
  });

  it('should create a mock payment record with 1% platform fee', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '10:00');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
    );

    const payment = await prisma.paymentRecord.findFirst({
      where: { appointment_id: appt.id },
    });
    expect(payment).toBeDefined();
    expect(Number(payment!.amount)).toBe(10000);
    expect(payment!.status).toBe('SUCCEEDED');
    expect(Number(payment!.platform_fee)).toBe(100); // 1% of 10000
    expect(payment!.stripe_payment_intent_id).toMatch(/^pi_mock_/);
  });

  it('should record consent on booking', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '10:30');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
      '10.0.0.1',
      'Mozilla/5.0',
    );

    const consent = await prisma.consentRecord.findFirst({
      where: { user_id: ctx.patient.id, type: 'DATA_PROCESSING' },
    });
    expect(consent).toBeDefined();
    expect(consent!.ip_address).toBe('10.0.0.1');
    expect(consent!.user_agent).toBe('Mozilla/5.0');
  });

  it('should create audit logs for appointment creation', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '11:00');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
    );

    const logs = await prisma.auditLog.findMany({
      where: { resource_id: appt.id },
      orderBy: { created_at: 'asc' },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => l.action === 'APPOINTMENT_CREATED')).toBe(true);
    // AUTO_CONFIRM generates both CREATED and CONFIRMED
    expect(logs.some((l) => l.action === 'APPOINTMENT_CONFIRMED')).toBe(true);
  });

  it('should reject booking with expired/invalid reservation', async () => {
    const ctx = await setupTestContext();

    await expect(
      appointments.createAppointment(
        {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          service_id: ctx.service.id,
          start_time: dateTime(ctx.futureDate, '09:00'),
          reservation_session_id: 'invalid-session',
          data_processing_consent: true,
        },
        ctx.patient.id,
      ),
    ).rejects.toThrow(SlotNoLongerAvailableError);
  });
});

// ─── Guest Checkout ────────────────────────

describe('Guest Checkout', () => {
  it('should create a guest user and book appointment', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '13:00');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
        patient_email: 'guest@example.com',
        patient_name: 'Guest Patient',
      },
      null, // no authenticated user
    );

    expect(appt.id).toBeDefined();
    expect(appt.patient.email).toBe('guest@example.com');

    // Verify the guest user was created
    const guestUser = await prisma.user.findUnique({
      where: { email: 'guest@example.com' },
    });
    expect(guestUser).toBeDefined();
    expect(guestUser!.name).toBe('Guest Patient');
    expect(guestUser!.email_verified).toBe(false);
  });

  it('should use existing user for guest checkout with existing email', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '13:30');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation.session_id,
        data_processing_consent: true,
        patient_email: ctx.patient.email, // existing user
      },
      null,
    );

    expect(appt.patient.id).toBe(ctx.patient.id);
  });

  it('should reject booking without auth or guest info', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '14:00');

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    await expect(
      appointments.createAppointment(
        {
          practice_id: ctx.practice.id,
          provider_profile_id: ctx.provider.id,
          service_id: ctx.service.id,
          start_time: startTime,
          reservation_session_id: reservation.session_id,
          data_processing_consent: true,
        },
        null, // no user, no guest info
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ─── State Machine ────────────────────────

describe('State Machine', () => {
  it('should transition PENDING → CONFIRMED', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'PENDING',
    });

    const updated = await appointments.transitionStatus(
      appt.id,
      'CONFIRMED',
      ctx.owner.id,
    );
    expect(updated.status).toBe('CONFIRMED');
  });

  it('should transition CONFIRMED → IN_PROGRESS and set checked_in_at', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const updated = await appointments.transitionStatus(
      appt.id,
      'IN_PROGRESS',
      ctx.owner.id,
    );
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.checked_in_at).toBeDefined();
  });

  it('should transition IN_PROGRESS → COMPLETED and set completed_at', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '10:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'IN_PROGRESS',
    });

    const updated = await appointments.transitionStatus(
      appt.id,
      'COMPLETED',
      ctx.owner.id,
    );
    expect(updated.status).toBe('COMPLETED');
    expect(updated.completed_at).toBeDefined();
  });

  it('should transition CONFIRMED → CANCELLED', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '10:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const updated = await appointments.transitionStatus(
      appt.id,
      'CANCELLED',
      ctx.owner.id,
      { reason: 'Test cancel' },
    );
    expect(updated.status).toBe('CANCELLED');
    expect(updated.cancelled_at).toBeDefined();
    expect(updated.cancelled_by).toBe(ctx.owner.id);
    expect(updated.cancellation_reason).toBe('Test cancel');
  });

  it('should reject invalid transition COMPLETED → CONFIRMED', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '11:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'COMPLETED',
    });

    await expect(
      appointments.transitionStatus(appt.id, 'CONFIRMED', ctx.owner.id),
    ).rejects.toThrow(InvalidAppointmentTransitionError);
  });

  it('should reject invalid transition CANCELLED → CONFIRMED', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '11:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CANCELLED',
    });

    await expect(
      appointments.transitionStatus(appt.id, 'CONFIRMED', ctx.owner.id),
    ).rejects.toThrow(InvalidAppointmentTransitionError);
  });

  it('should reject invalid transition PENDING → IN_PROGRESS', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '12:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'PENDING',
    });

    await expect(
      appointments.transitionStatus(appt.id, 'IN_PROGRESS', ctx.owner.id),
    ).rejects.toThrow(InvalidAppointmentTransitionError);
  });

  it('should set NO_SHOW from CONFIRMED', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '12:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const updated = await appointments.transitionStatus(
      appt.id,
      'NO_SHOW',
      ctx.owner.id,
    );
    expect(updated.status).toBe('NO_SHOW');
  });
});

// ─── Cancellation with Policy ────────────────────────

describe('Cancellation with Policy', () => {
  it('should give full refund when cancelling well in advance', async () => {
    const ctx = await setupTestContext();
    // Schedule 7+ days ahead — definitely within free_cancel_hours (default 24h)
    const startTime = new Date(dateTime(ctx.futureDate, '09:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    // Create payment record
    await prisma.paymentRecord.create({
      data: {
        practice_id: ctx.practice.id,
        appointment_id: appt.id,
        amount: 10000,
        currency: 'USD',
        status: 'SUCCEEDED',
        stripe_payment_intent_id: 'pi_mock_test',
        platform_fee: 100,
      },
    });

    const result = await appointments.cancelAppointment(
      appt.id,
      ctx.patient.id,
      { reason: 'Cannot make it' },
    );

    expect(result.cancellation.refund_type).toBe('FULL_REFUND');
    expect(result.cancellation.refund_amount).toBe(10000);
    expect(result.cancellation.fee).toBe(0);
    expect(result.appointment.status).toBe('CANCELLED');

    // Verify payment updated
    const payment = await prisma.paymentRecord.findFirst({
      where: { appointment_id: appt.id },
    });
    expect(payment!.status).toBe('REFUNDED');
    expect(Number(payment!.refund_amount)).toBe(10000);
  });

  it('should return NONE when appointment has no payment', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const result = await appointments.cancelAppointment(
      appt.id,
      ctx.patient.id,
      {},
    );

    expect(result.cancellation.refund_type).toBe('NONE');
    expect(result.appointment.status).toBe('CANCELLED');
  });

  it('should create audit log on cancellation', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '10:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    await appointments.cancelAppointment(appt.id, ctx.patient.id, {
      reason: 'Audit test',
    });

    const log = await prisma.auditLog.findFirst({
      where: { resource_id: appt.id, action: 'APPOINTMENT_CANCELLED' },
    });
    expect(log).toBeDefined();
    expect((log!.metadata as any).reason).toBe('Audit test');
  });
});

// ─── Rescheduling ────────────────────────

describe('Rescheduling', () => {
  it('should reschedule a confirmed appointment to a new slot', async () => {
    const ctx = await setupTestContext();
    const originalStart = new Date(dateTime(ctx.futureDate, '09:00'));
    const newStart = new Date(dateTime(ctx.futureDate, '14:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime: originalStart,
      endTime: new Date(originalStart.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    // Reserve new slot
    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: newStart.toISOString(),
    });

    const rescheduled = await appointments.rescheduleAppointment(
      appt.id,
      {
        new_start_time: newStart.toISOString(),
        reservation_session_id: reservation.session_id,
      },
      ctx.patient.id,
    );

    expect(new Date(rescheduled.start_time).getTime()).toBe(newStart.getTime());
    expect(rescheduled.status).toBe('CONFIRMED');
  });

  it('should reject rescheduling a non-confirmed appointment', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:30'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      status: 'PENDING',
    });

    await expect(
      appointments.rescheduleAppointment(
        appt.id,
        {
          new_start_time: dateTime(ctx.futureDate, '15:00'),
          reservation_session_id: 'irrelevant',
        },
        ctx.patient.id,
      ),
    ).rejects.toThrow(InvalidAppointmentTransitionError);
  });

  it('should create audit log for rescheduling', async () => {
    const ctx = await setupTestContext();
    const originalStart = new Date(dateTime(ctx.futureDate, '10:00'));
    const newStart = new Date(dateTime(ctx.futureDate, '15:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime: originalStart,
      endTime: new Date(originalStart.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const reservation = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: newStart.toISOString(),
    });

    await appointments.rescheduleAppointment(
      appt.id,
      {
        new_start_time: newStart.toISOString(),
        reservation_session_id: reservation.session_id,
      },
      ctx.patient.id,
    );

    const log = await prisma.auditLog.findFirst({
      where: { resource_id: appt.id, action: 'APPOINTMENT_RESCHEDULED' },
    });
    expect(log).toBeDefined();
  });
});

// ─── Queries ────────────────────────

describe('Queries', () => {
  it('should find appointment by id with relations', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    });

    const found = await appointments.findById(appt.id);
    expect(found.id).toBe(appt.id);
    expect(found.patient.email).toBe('patient@phase4.test');
    expect(found.provider.id).toBe(ctx.provider.id);
    expect(found.service.name).toBe('Consultation');
  });

  it('should list appointments for practice', async () => {
    const ctx = await setupTestContext();

    for (let i = 0; i < 3; i++) {
      const hour = String(9 + i).padStart(2, '0');
      const t = new Date(dateTime(ctx.futureDate, `${hour}:00`));
      await createTestAppointment(prisma, {
        practiceId: ctx.practice.id,
        providerProfileId: ctx.provider.id,
        patientId: ctx.patient.id,
        serviceId: ctx.service.id,
        startTime: t,
        endTime: new Date(t.getTime() + 30 * 60 * 1000),
      });
    }

    const result = await appointments.listForPractice(ctx.practice.id);
    expect(result.data.length).toBe(3);
    expect(result.total).toBe(3);
  });

  it('should list appointments for patient', async () => {
    const ctx = await setupTestContext();

    for (let i = 0; i < 2; i++) {
      const hour = String(9 + i).padStart(2, '0');
      const t = new Date(dateTime(ctx.futureDate, `${hour}:00`));
      await createTestAppointment(prisma, {
        practiceId: ctx.practice.id,
        providerProfileId: ctx.provider.id,
        patientId: ctx.patient.id,
        serviceId: ctx.service.id,
        startTime: t,
        endTime: new Date(t.getTime() + 30 * 60 * 1000),
      });
    }

    const result = await appointments.listForPatient(ctx.patient.id);
    expect(result.data.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('should filter by status', async () => {
    const ctx = await setupTestContext();

    const t1 = new Date(dateTime(ctx.futureDate, '09:00'));
    await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime: t1,
      endTime: new Date(t1.getTime() + 30 * 60 * 1000),
      status: 'CONFIRMED',
    });

    const t2 = new Date(dateTime(ctx.futureDate, '10:00'));
    await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime: t2,
      endTime: new Date(t2.getTime() + 30 * 60 * 1000),
      status: 'CANCELLED',
    });

    const result = await appointments.listForPractice(ctx.practice.id, {
      status: 'CONFIRMED',
    });
    expect(result.data.length).toBe(1);
    expect(result.data[0].status).toBe('CONFIRMED');
  });
});

// ─── Notes ────────────────────────

describe('Notes', () => {
  it('should update appointment notes', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:00'));

    const appt = await createTestAppointment(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      patientId: ctx.patient.id,
      serviceId: ctx.service.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    });

    const updated = await appointments.updateNotes(appt.id, {
      notes: 'Patient reported headache for 3 days',
    });
    expect(updated.notes).toBe('Patient reported headache for 3 days');
  });
});

// ─── Concurrent Booking ────────────────────────

describe('Concurrent Booking', () => {
  it('should prevent double-booking the same slot', async () => {
    const ctx = await setupTestContext();
    const startTime = dateTime(ctx.futureDate, '09:00');

    // First reservation succeeds
    const reservation1 = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime,
    });

    // Second reservation should fail (slot held)
    await expect(
      appointments.reserveSlot({
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
      }),
    ).rejects.toThrow(SlotTemporarilyHeldError);

    // First booking succeeds
    const appt = await appointments.createAppointment(
      {
        practice_id: ctx.practice.id,
        provider_profile_id: ctx.provider.id,
        service_id: ctx.service.id,
        start_time: startTime,
        reservation_session_id: reservation1.session_id,
        data_processing_consent: true,
      },
      ctx.patient.id,
    );
    expect(appt.status).toBe('CONFIRMED');
  });

  it('should allow booking after expired reservation', async () => {
    const ctx = await setupTestContext();
    const startTime = new Date(dateTime(ctx.futureDate, '09:00'));

    // Create an expired reservation directly
    await createTestSlotReservation(prisma, {
      practiceId: ctx.practice.id,
      providerProfileId: ctx.provider.id,
      startTime,
      endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      sessionId: 'expired-session',
      expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
    });

    // New reservation should succeed (old one expired)
    const result = await appointments.reserveSlot({
      practice_id: ctx.practice.id,
      provider_profile_id: ctx.provider.id,
      service_id: ctx.service.id,
      start_time: startTime.toISOString(),
    });

    expect(result.reservation_id).toBeDefined();
  });
});
