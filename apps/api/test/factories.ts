// Test factory functions for integration tests
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const DEFAULT_PASSWORD = 'TestPassword123!';
const BCRYPT_TEST_ROUNDS = 4; // Faster for tests

let counter = 0;
function uniqueId() {
  return ++counter;
}

export function resetFactoryCounter() {
  counter = 0;
}

export async function createTestUser(
  prisma: PrismaService,
  overrides: Partial<{
    email: string;
    name: string;
    password: string;
    role: 'PLATFORM_ADMIN' | 'USER';
    email_verified: boolean;
    google_id: string;
  }> = {},
) {
  const id = uniqueId();
  const password = overrides.password || DEFAULT_PASSWORD;
  const passwordHash = await bcrypt.hash(password, BCRYPT_TEST_ROUNDS);

  return prisma.user.create({
    data: {
      email: overrides.email || `test-user-${id}@medconnect.test`,
      name: overrides.name || `Test User ${id}`,
      password_hash: passwordHash,
      role: overrides.role || 'USER',
      email_verified: overrides.email_verified ?? true,
      google_id: overrides.google_id,
    },
  });
}

export async function createTestPractice(
  prisma: PrismaService,
  overrides: Partial<{
    name: string;
    slug: string;
    category: string;
    timezone: string;
  }> = {},
) {
  const id = uniqueId();
  return prisma.practice.create({
    data: {
      name: overrides.name || `Test Practice ${id}`,
      slug: overrides.slug || `test-practice-${id}`,
      category: overrides.category || 'PRIMARY_CARE',
      timezone: overrides.timezone || 'America/New_York',
    },
  });
}

export async function createTestMembership(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    userId: string;
    role?: 'OWNER' | 'ADMIN' | 'PROVIDER';
  },
) {
  return prisma.tenantMembership.create({
    data: {
      practice_id: opts.practiceId,
      user_id: opts.userId,
      role: opts.role || 'OWNER',
    },
  });
}

export async function createTestProvider(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    userId: string;
    specialties?: string[];
    consultationTypes?: string[];
  },
) {
  return prisma.providerProfile.create({
    data: {
      practice_id: opts.practiceId,
      user_id: opts.userId,
      specialties: opts.specialties || ['General Practice'],
      consultation_types: (opts.consultationTypes as any) || ['VIDEO'],
      bio: 'Test provider bio',
    },
  });
}

export async function createTestService(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    providerProfileIds?: string[];
    name?: string;
    durationMinutes?: number;
    price?: number;
    bufferBefore?: number;
    bufferAfter?: number;
    maxParticipants?: number;
  },
) {
  const id = uniqueId();
  const service = await prisma.service.create({
    data: {
      practice_id: opts.practiceId,
      name: opts.name || `Test Service ${id}`,
      duration_minutes: opts.durationMinutes || 30,
      price: opts.price ?? 100,
      buffer_before_minutes: opts.bufferBefore ?? 0,
      buffer_after_minutes: opts.bufferAfter ?? 0,
      max_participants: opts.maxParticipants ?? 1,
    },
  });

  if (opts.providerProfileIds) {
    await Promise.all(
      opts.providerProfileIds.map((ppId) =>
        prisma.serviceProvider.create({
          data: { service_id: service.id, provider_profile_id: ppId },
        }),
      ),
    );
  }

  return service;
}

export async function createTestAvailabilityRule(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    dayOfWeek: number;
    startTime?: string; // HH:mm
    endTime?: string;   // HH:mm
    slotDurationMinutes?: number;
  },
) {
  return prisma.availabilityRule.create({
    data: {
      practice_id: opts.practiceId,
      provider_profile_id: opts.providerProfileId,
      day_of_week: opts.dayOfWeek,
      start_time: new Date(`1970-01-01T${opts.startTime || '09:00'}:00Z`),
      end_time: new Date(`1970-01-01T${opts.endTime || '17:00'}:00Z`),
      slot_duration_minutes: opts.slotDurationMinutes || 30,
    },
  });
}

export async function createTestBlockedDate(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;
    reason?: string;
  },
) {
  return prisma.blockedDate.create({
    data: {
      practice_id: opts.practiceId,
      provider_profile_id: opts.providerProfileId,
      start_date: new Date(opts.startDate),
      end_date: new Date(opts.endDate),
      reason: opts.reason,
    },
  });
}

export async function createTestAppointment(
  prisma: PrismaService,
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
  return prisma.appointment.create({
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

export async function createTestSlotReservation(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    startTime: Date;
    endTime: Date;
    sessionId?: string;
    expiresAt?: Date;
  },
) {
  return prisma.slotReservation.create({
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

export async function createTestPaymentRecord(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    appointmentId: string;
    amount?: number;
    currency?: string;
    status?: string;
  },
) {
  return prisma.paymentRecord.create({
    data: {
      practice_id: opts.practiceId,
      appointment_id: opts.appointmentId,
      amount: opts.amount ?? 100,
      currency: opts.currency || 'USD',
      status: (opts.status || 'SUCCEEDED') as any,
      stripe_payment_intent_id: `pi_mock_${randomBytes(12).toString('hex')}`,
      platform_fee: Math.round((opts.amount ?? 100) * 1) / 100,
    },
  });
}

export async function createTestVideoRoom(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    appointmentId: string;
    status?: string;
  },
) {
  return prisma.videoRoom.create({
    data: {
      practice_id: opts.practiceId,
      appointment_id: opts.appointmentId,
      twilio_room_sid: `RM_mock_${randomBytes(12).toString('hex')}`,
      twilio_room_name: `appt_${opts.appointmentId.replace(/-/g, '')}`,
      status: (opts.status || 'CREATED') as any,
      max_participants: 2,
    },
  });
}

export async function createTestCalendarConnection(
  prisma: PrismaService,
  opts: {
    practiceId: string;
    providerProfileId: string;
    provider?: string;
    status?: string;
  },
) {
  return prisma.calendarConnection.create({
    data: {
      practice_id: opts.practiceId,
      provider_profile_id: opts.providerProfileId,
      provider: (opts.provider || 'GOOGLE') as any,
      status: (opts.status || 'ACTIVE') as any,
      calendar_id: `mock_cal_${randomBytes(8).toString('hex')}`,
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      token_expires_at: new Date(Date.now() + 3600 * 1000),
    },
  });
}

export { DEFAULT_PASSWORD };
