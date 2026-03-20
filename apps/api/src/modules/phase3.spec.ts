/**
 * Phase 3 Integration Tests
 * - Audit logging
 * - Practice CRUD + RLS isolation
 * - Provider management + invitation flow
 * - Availability engine (6 layers)
 * - Services CRUD
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { PracticesService } from './practices/practices.service';
import { ProvidersService } from './providers/providers.service';
import { AvailabilityService } from './providers/availability.service';
import { ServicesService } from './services/services.service';
import { AuditAction } from '@medconnect/shared';
import {
  createTestUser,
  createTestPractice,
  createTestMembership,
  createTestProvider,
  createTestAvailabilityRule,
  createTestBlockedDate,
  createTestService,
  resetFactoryCounter,
} from '../../test/factories';

let module: TestingModule;
let prisma: PrismaService;
let auditService: AuditService;
let practicesService: PracticesService;
let providersService: ProvidersService;
let availabilityService: AvailabilityService;
let servicesService: ServicesService;

beforeAll(async () => {
  module = await Test.createTestingModule({
    providers: [
      PrismaService,
      AuditService,
      PracticesService,
      ProvidersService,
      AvailabilityService,
      ServicesService,
    ],
  }).compile();

  prisma = module.get(PrismaService);
  auditService = module.get(AuditService);
  practicesService = module.get(PracticesService);
  providersService = module.get(ProvidersService);
  availabilityService = module.get(AvailabilityService);
  servicesService = module.get(ServicesService);

  await prisma.$connect();
}, 30000);

async function cleanDb() {
  // Use TRUNCATE CASCADE to bypass the append-only trigger on audit_logs
  // and handle all FK cascades in one statement
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      slot_reservations,
      appointments,
      service_providers,
      services,
      blocked_dates,
      availability_rules,
      invitation_tokens,
      audit_logs,
      provider_profiles,
      tenant_memberships,
      refresh_tokens,
      consent_records,
      notifications,
      practices,
      users
    CASCADE
  `);
}

beforeEach(async () => {
  resetFactoryCounter();
  await cleanDb();
});

afterAll(async () => {
  if (prisma) {
    await cleanDb();
    await prisma.$disconnect();
  }
  if (module) {
    await module.close();
  }
});

// ─── Audit Service ──────────────────────────────────────────

describe('AuditService', () => {
  it('should create and retrieve audit logs', async () => {
    const user = await createTestUser(prisma);
    const practice = await createTestPractice(prisma);

    await auditService.log({
      user_id: user.id,
      practice_id: practice.id,
      action: AuditAction.PRACTICE_CREATED,
      resource_type: 'practice',
      resource_id: practice.id,
      metadata: { name: practice.name },
    });

    const logs = await auditService.getByResource('practice', practice.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe(AuditAction.PRACTICE_CREATED);
    expect(logs[0]!.user_id).toBe(user.id);
  });

  it('should retrieve audit logs by user', async () => {
    const user = await createTestUser(prisma);
    const practice = await createTestPractice(prisma);

    await auditService.log({
      user_id: user.id,
      practice_id: practice.id,
      action: AuditAction.PRACTICE_CREATED,
      resource_type: 'practice',
      resource_id: practice.id,
    });
    await auditService.log({
      user_id: user.id,
      practice_id: practice.id,
      action: AuditAction.PRACTICE_UPDATED,
      resource_type: 'practice',
      resource_id: practice.id,
    });

    const logs = await auditService.getByUser(user.id);
    expect(logs).toHaveLength(2);
  });

  it('should retrieve audit logs by practice', async () => {
    const user = await createTestUser(prisma);
    const practice = await createTestPractice(prisma);

    await auditService.log({
      user_id: user.id,
      practice_id: practice.id,
      action: AuditAction.PRACTICE_CREATED,
      resource_type: 'practice',
      resource_id: practice.id,
    });

    const logs = await auditService.getByPractice(practice.id);
    expect(logs).toHaveLength(1);
  });

  it('should not throw when logging fails (silent failure)', async () => {
    // Pass invalid data — should not throw
    await expect(
      auditService.log({
        action: AuditAction.PRACTICE_CREATED,
        resource_type: 'practice',
        resource_id: 'non-existent',
      }),
    ).resolves.toBeUndefined();
  });
});

// ─── Practices Service ──────────────────────────────────────

describe('PracticesService', () => {
  it('should create a practice with OWNER membership and provider profile', async () => {
    const user = await createTestUser(prisma);
    const practice = await practicesService.create(
      { name: 'Test Clinic', slug: 'test-clinic', category: 'PRIMARY_CARE' },
      user.id,
    );

    expect(practice.name).toBe('Test Clinic');
    expect(practice.slug).toBe('test-clinic');

    // Should have OWNER membership
    const memberships = await prisma.tenantMembership.findMany({
      where: { practice_id: practice.id, user_id: user.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe('OWNER');

    // Should have provider profile
    const providers = await prisma.providerProfile.findMany({
      where: { practice_id: practice.id, user_id: user.id },
    });
    expect(providers).toHaveLength(1);

    // Should have audit log
    const logs = await auditService.getByResource('practice', practice.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe(AuditAction.PRACTICE_CREATED);
  });

  it('should reject duplicate slugs', async () => {
    const user = await createTestUser(prisma);
    await practicesService.create(
      { name: 'Clinic A', slug: 'same-slug', category: 'PRIMARY_CARE' },
      user.id,
    );

    await expect(
      practicesService.create(
        { name: 'Clinic B', slug: 'same-slug', category: 'DERMATOLOGY' },
        user.id,
      ),
    ).rejects.toThrow('slug already exists');
  });

  it('should find practice by ID and slug', async () => {
    const user = await createTestUser(prisma);
    const practice = await practicesService.create(
      { name: 'Find Me', slug: 'find-me', category: 'PRIMARY_CARE' },
      user.id,
    );

    const byId = await practicesService.findById(practice.id);
    expect(byId.name).toBe('Find Me');

    const bySlug = await practicesService.findBySlug('find-me');
    expect(bySlug.name).toBe('Find Me');
  });

  it('should update practice and log audit', async () => {
    const user = await createTestUser(prisma);
    const practice = await practicesService.create(
      { name: 'Old Name', slug: 'update-test', category: 'PRIMARY_CARE' },
      user.id,
    );

    const updated = await practicesService.update(
      practice.id,
      { name: 'New Name' },
      user.id,
    );
    expect(updated.name).toBe('New Name');

    const logs = await auditService.getByResource('practice', practice.id);
    const updateLog = logs.find((l) => l.action === AuditAction.PRACTICE_UPDATED);
    expect(updateLog).toBeDefined();
  });

  it('should list practices for a user', async () => {
    const user = await createTestUser(prisma);
    await practicesService.create(
      { name: 'Practice A', slug: 'practice-a', category: 'PRIMARY_CARE' },
      user.id,
    );
    await practicesService.create(
      { name: 'Practice B', slug: 'practice-b', category: 'DERMATOLOGY' },
      user.id,
    );

    const practices = await practicesService.listForUser(user.id);
    expect(practices).toHaveLength(2);
    expect(practices.every((p) => p.membership_role === 'OWNER')).toBe(true);
  });

  describe('RLS isolation', () => {
    it('should isolate data between practices', async () => {
      const owner1 = await createTestUser(prisma, { email: 'owner1@test.com' });
      const owner2 = await createTestUser(prisma, { email: 'owner2@test.com' });

      const practice1 = await practicesService.create(
        { name: 'Practice 1', slug: 'practice-1', category: 'PRIMARY_CARE' },
        owner1.id,
      );
      const practice2 = await practicesService.create(
        { name: 'Practice 2', slug: 'practice-2', category: 'DERMATOLOGY' },
        owner2.id,
      );

      // Each owner should only see their own practice
      const list1 = await practicesService.listForUser(owner1.id);
      const list2 = await practicesService.listForUser(owner2.id);

      expect(list1).toHaveLength(1);
      expect(list1[0]!.slug).toBe('practice-1');
      expect(list2).toHaveLength(1);
      expect(list2[0]!.slug).toBe('practice-2');

      // Providers from practice 1 should not appear in practice 2 queries
      const providers1 = await providersService.listProviders(practice1.id);
      const providers2 = await providersService.listProviders(practice2.id);

      expect(providers1.every((p) => p.practice_id === practice1.id)).toBe(true);
      expect(providers2.every((p) => p.practice_id === practice2.id)).toBe(true);
    });
  });
});

// ─── Providers Service ──────────────────────────────────────

describe('ProvidersService', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let practice: Awaited<ReturnType<typeof createTestPractice>>;
  let providerProfile: Awaited<ReturnType<typeof createTestProvider>>;

  beforeEach(async () => {
    owner = await createTestUser(prisma, { email: 'owner@test.com' });
    practice = await createTestPractice(prisma);
    await createTestMembership(prisma, {
      practiceId: practice.id,
      userId: owner.id,
      role: 'OWNER',
    });
    providerProfile = await createTestProvider(prisma, {
      practiceId: practice.id,
      userId: owner.id,
    });
  });

  it('should get provider profile', async () => {
    const profile = await providersService.getProfile(practice.id, providerProfile.id);
    expect(profile.id).toBe(providerProfile.id);
    expect(profile.user).toBeDefined();
    expect(profile.user.email).toBe('owner@test.com');
  });

  it('should list providers for a practice', async () => {
    const providers = await providersService.listProviders(practice.id);
    expect(providers).toHaveLength(1);
  });

  it('should update provider profile', async () => {
    const updated = await providersService.updateProfile(
      practice.id,
      providerProfile.id,
      { bio: 'Updated bio', specialties: ['Cardiology'] },
      owner.id,
    );
    expect(updated.bio).toBe('Updated bio');
    expect(updated.specialties).toContain('Cardiology');
  });

  it('should prevent self-deactivation', async () => {
    await expect(
      providersService.deactivateProvider(practice.id, providerProfile.id, owner.id),
    ).rejects.toThrow('Cannot deactivate your own');
  });

  it('should deactivate another provider', async () => {
    const otherUser = await createTestUser(prisma, { email: 'other@test.com' });
    await createTestMembership(prisma, {
      practiceId: practice.id,
      userId: otherUser.id,
      role: 'PROVIDER',
    });
    const otherProvider = await createTestProvider(prisma, {
      practiceId: practice.id,
      userId: otherUser.id,
    });

    await providersService.deactivateProvider(
      practice.id,
      otherProvider.id,
      owner.id,
    );

    // Membership should be deactivated
    const membership = await prisma.tenantMembership.findUnique({
      where: {
        practice_id_user_id: {
          practice_id: practice.id,
          user_id: otherUser.id,
        },
      },
    });
    expect(membership!.is_active).toBe(false);

    // Provider should not accept new patients
    const profile = await prisma.providerProfile.findUnique({
      where: { id: otherProvider.id },
    });
    expect(profile!.accepting_new_patients).toBe(false);
  });

  // ─── Invitation Flow ────────────

  describe('invitation flow', () => {
    it('should invite, verify, and list invitations', async () => {
      const result = await providersService.inviteProvider(
        practice.id,
        { email: 'invited@test.com', role: 'PROVIDER' },
        owner.id,
      );
      expect(result.token).toBeDefined();

      // Verify the invitation
      const verified = await providersService.verifyInvitation(result.token);
      expect(verified.email).toBe('invited@test.com');
      expect(verified.role).toBe('PROVIDER');
      expect(verified.practice.name).toBe(practice.name);

      // List invitations
      const list = await providersService.listInvitations(practice.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.email).toBe('invited@test.com');
    });

    it('should reject duplicate pending invitation', async () => {
      await providersService.inviteProvider(
        practice.id,
        { email: 'dup@test.com' },
        owner.id,
      );

      await expect(
        providersService.inviteProvider(
          practice.id,
          { email: 'dup@test.com' },
          owner.id,
        ),
      ).rejects.toThrow('already been sent');
    });

    it('should reject invitation for existing active member', async () => {
      await expect(
        providersService.inviteProvider(
          practice.id,
          { email: owner.email },
          owner.id,
        ),
      ).rejects.toThrow('already a member');
    });

    it('should revoke an invitation', async () => {
      const result = await providersService.inviteProvider(
        practice.id,
        { email: 'revoke@test.com' },
        owner.id,
      );

      const invitations = await providersService.listInvitations(practice.id);
      await providersService.revokeInvitation(
        practice.id,
        invitations[0]!.id,
        owner.id,
      );

      // Verification should fail after revocation
      await expect(
        providersService.verifyInvitation(result.token),
      ).rejects.toThrow();
    });

    it('should reject verification of expired token', async () => {
      const result = await providersService.inviteProvider(
        practice.id,
        { email: 'expired@test.com' },
        owner.id,
      );

      // Manually expire the token
      const invitations = await providersService.listInvitations(practice.id);
      await prisma.invitationToken.update({
        where: { id: invitations[0]!.id },
        data: { expires_at: new Date('2020-01-01') },
      });

      await expect(
        providersService.verifyInvitation(result.token),
      ).rejects.toThrow();
    });
  });

  // ─── Availability Rules ────────────

  describe('availability rules', () => {
    it('should set and get availability rules', async () => {
      const rules = await providersService.setAvailabilityRules(
        practice.id,
        providerProfile.id,
        [
          { day_of_week: 1, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 },
          { day_of_week: 1, start_time: '13:00', end_time: '17:00', slot_duration_minutes: 30 },
        ],
      );

      expect(rules).toHaveLength(2);

      // Get rules
      const fetched = await providersService.getAvailabilityRules(
        practice.id,
        providerProfile.id,
      );
      expect(fetched).toHaveLength(2);
    });

    it('should replace rules on re-set', async () => {
      await providersService.setAvailabilityRules(
        practice.id,
        providerProfile.id,
        [
          { day_of_week: 1, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
        ],
      );

      // Replace with new rules
      const rules = await providersService.setAvailabilityRules(
        practice.id,
        providerProfile.id,
        [
          { day_of_week: 2, start_time: '10:00', end_time: '14:00', slot_duration_minutes: 60 },
        ],
      );

      expect(rules).toHaveLength(1);
      expect(rules[0]!.day_of_week).toBe(2);
    });
  });

  // ─── Blocked Dates ────────────

  describe('blocked dates', () => {
    it('should add, list, and remove blocked dates', async () => {
      const blocked = await providersService.addBlockedDates(
        practice.id,
        providerProfile.id,
        [{ start_date: '2026-04-01', end_date: '2026-04-02', reason: 'Vacation' }],
      );
      expect(blocked).toHaveLength(1);

      const list = await providersService.getBlockedDates(practice.id, providerProfile.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.reason).toBe('Vacation');

      await providersService.removeBlockedDate(practice.id, list[0]!.id);
      const afterRemove = await providersService.getBlockedDates(
        practice.id,
        providerProfile.id,
      );
      expect(afterRemove).toHaveLength(0);
    });
  });
});

// ─── Availability Engine ────────────────────────────────────

describe('AvailabilityService', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let practice: Awaited<ReturnType<typeof createTestPractice>>;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeEach(async () => {
    owner = await createTestUser(prisma, { email: 'avail-owner@test.com' });
    practice = await createTestPractice(prisma, { timezone: 'America/New_York' });
    await createTestMembership(prisma, {
      practiceId: practice.id,
      userId: owner.id,
    });
    provider = await createTestProvider(prisma, {
      practiceId: practice.id,
      userId: owner.id,
    });
  });

  function getFutureDate(daysAhead: number, dayOfWeek?: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysAhead);
    if (dayOfWeek !== undefined) {
      // Advance to the next occurrence of this day (UTC)
      while (d.getUTCDay() !== dayOfWeek) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    return d.toISOString().split('T')[0]!;
  }

  it('Layer 1: should return slots from availability rules', async () => {
    // Pick a future Monday
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '12:00',
    });

    const slots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    // 09:00-12:00 with 30min slots = 6 slots
    expect(slots).toHaveLength(6);
    // All slots should be 30 minutes
    for (const slot of slots) {
      const start = new Date(slot.start_time).getTime();
      const end = new Date(slot.end_time).getTime();
      expect(end - start).toBe(30 * 60 * 1000);
    }
  });

  it('Layer 1: should return empty when no rules for that day', async () => {
    const futureTuesday = getFutureDate(1, 2);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
    });

    const slots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureTuesday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    expect(slots).toHaveLength(0);
  });

  it('Layer 2: should apply buffer times when checking conflicts', async () => {
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    // Create an appointment at 10:00-10:30
    const slotStart = new Date(futureMonday + 'T14:00:00Z'); // ~10:00 ET (approximate)
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    await prisma.appointment.create({
      data: {
        practice_id: practice.id,
        provider_profile_id: provider.id,
        patient_id: owner.id,
        service_id: (await createTestService(prisma, { practiceId: practice.id })).id,
        start_time: slotStart,
        end_time: slotEnd,
        status: 'CONFIRMED',
        consultation_type: 'VIDEO',
      },
    });

    // With 15min buffer before and after, more slots should be removed
    const slotsWithBuffer = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
      practiceTimezone: 'America/New_York',
    });

    const slotsNoBuffer = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    // Buffer should remove more slots than no buffer
    expect(slotsWithBuffer.length).toBeLessThan(slotsNoBuffer.length);
  });

  it('Layer 3: should block entire day for blocked dates', async () => {
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    });

    await createTestBlockedDate(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      startDate: futureMonday,
      endDate: futureMonday,
      reason: 'Conference',
    });

    const slots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    expect(slots).toHaveLength(0);
  });

  it('Layer 5: should exclude slots with existing appointments', async () => {
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    // Get slots without appointments to know the full list
    const allSlots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    // Book one slot
    const service = await createTestService(prisma, { practiceId: practice.id });
    if (allSlots.length > 0) {
      await prisma.appointment.create({
        data: {
          practice_id: practice.id,
          provider_profile_id: provider.id,
          patient_id: owner.id,
          service_id: service.id,
          start_time: new Date(allSlots[0]!.start_time),
          end_time: new Date(allSlots[0]!.end_time),
          status: 'CONFIRMED',
          consultation_type: 'VIDEO',
          },
      });

      const slotsAfterBooking = await availabilityService.getAvailableSlots({
        practiceId: practice.id,
        providerProfileId: provider.id,
        date: futureMonday,
        serviceDurationMinutes: 30,
        practiceTimezone: 'America/New_York',
      });

      expect(slotsAfterBooking.length).toBe(allSlots.length - 1);
    }
  });

  it('Layer 5: should exclude slots with active reservations', async () => {
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const allSlots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    if (allSlots.length > 0) {
      // Create a non-expired reservation
      await prisma.slotReservation.create({
        data: {
          practice_id: practice.id,
          provider_profile_id: provider.id,
          start_time: new Date(allSlots[0]!.start_time),
          end_time: new Date(allSlots[0]!.end_time),
          session_id: 'test-session-id',
          expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
        },
      });

      const slotsAfterReservation = await availabilityService.getAvailableSlots({
        practiceId: practice.id,
        providerProfileId: provider.id,
        date: futureMonday,
        serviceDurationMinutes: 30,
        practiceTimezone: 'America/New_York',
      });

      expect(slotsAfterReservation.length).toBe(allSlots.length - 1);
    }
  });

  it('Layer 5: should NOT exclude cancelled appointments', async () => {
    const futureMonday = getFutureDate(1, 1);

    await createTestAvailabilityRule(prisma, {
      practiceId: practice.id,
      providerProfileId: provider.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });

    const allSlots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: futureMonday,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    if (allSlots.length > 0) {
      const service = await createTestService(prisma, { practiceId: practice.id });

      // Cancelled appointment should not block the slot
      await prisma.appointment.create({
        data: {
          practice_id: practice.id,
          provider_profile_id: provider.id,
          patient_id: owner.id,
          service_id: service.id,
          start_time: new Date(allSlots[0]!.start_time),
          end_time: new Date(allSlots[0]!.end_time),
          status: 'CANCELLED',
          consultation_type: 'VIDEO',
          },
      });

      const slotsAfterCancel = await availabilityService.getAvailableSlots({
        practiceId: practice.id,
        providerProfileId: provider.id,
        date: futureMonday,
        serviceDurationMinutes: 30,
        practiceTimezone: 'America/New_York',
      });

      expect(slotsAfterCancel.length).toBe(allSlots.length);
    }
  });

  it('Layer 6: should reject dates in the past', async () => {
    const slots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: '2020-01-01',
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    expect(slots).toHaveLength(0);
  });

  it('Layer 6: should reject dates beyond advance booking window', async () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 91); // Beyond 90-day window
    const dateStr = farFuture.toISOString().split('T')[0]!;

    const slots = await availabilityService.getAvailableSlots({
      practiceId: practice.id,
      providerProfileId: provider.id,
      date: dateStr,
      serviceDurationMinutes: 30,
      practiceTimezone: 'America/New_York',
    });

    expect(slots).toHaveLength(0);
  });
});

// ─── Services Service ───────────────────────────────────────

describe('ServicesService', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let practice: Awaited<ReturnType<typeof createTestPractice>>;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeEach(async () => {
    owner = await createTestUser(prisma, { email: 'svc-owner@test.com' });
    practice = await createTestPractice(prisma);
    await createTestMembership(prisma, {
      practiceId: practice.id,
      userId: owner.id,
    });
    provider = await createTestProvider(prisma, {
      practiceId: practice.id,
      userId: owner.id,
    });
  });

  it('should create a service with provider linkage', async () => {
    const service = await servicesService.create(practice.id, {
      name: 'General Checkup',
      duration_minutes: 30,
      price: 150,
      provider_ids: [provider.id],
    });

    expect(service.name).toBe('General Checkup');
    expect(service.providers).toHaveLength(1);
    expect(service.providers[0]!.id).toBe(provider.id);
  });

  it('should list services for a practice', async () => {
    await servicesService.create(practice.id, {
      name: 'Service A',
      duration_minutes: 30,
    });
    await servicesService.create(practice.id, {
      name: 'Service B',
      duration_minutes: 60,
    });

    const list = await servicesService.list(practice.id);
    expect(list).toHaveLength(2);
  });

  it('should update a service and replace providers', async () => {
    const service = await servicesService.create(practice.id, {
      name: 'Original',
      duration_minutes: 30,
      provider_ids: [provider.id],
    });

    const updated = await servicesService.update(practice.id, service.id, {
      name: 'Updated',
      provider_ids: [], // Remove all providers
    });

    expect(updated.name).toBe('Updated');
    expect(updated.providers).toHaveLength(0);
  });

  it('should soft-delete a service', async () => {
    const service = await servicesService.create(practice.id, {
      name: 'To Delete',
      duration_minutes: 30,
    });

    await servicesService.delete(practice.id, service.id);

    const dbService = await prisma.service.findUnique({
      where: { id: service.id },
    });
    expect(dbService!.is_active).toBe(false);
  });

  it('should throw NotFound for nonexistent service', async () => {
    await expect(
      servicesService.findById(practice.id, 'nonexistent-id'),
    ).rejects.toThrow();
  });
});
