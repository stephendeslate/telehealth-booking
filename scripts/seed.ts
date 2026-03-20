/**
 * MedConnect Seed Data Pipeline
 *
 * Creates 5 practices, 15 providers, 50 patients, and 200+ appointments
 * spanning all statuses, plus messages, intake submissions, payments,
 * notifications, and availability rules.
 *
 * All patient data is synthetic (Synthea-inspired names and data).
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function futureDate(daysAhead: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pastDate(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Synthetic Data ──────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Dorothy', 'Andrew', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna',
  'Kevin', 'Michelle', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa',
  'Ronald', 'Deborah',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

const PROVIDER_SPECIALTIES: Record<string, string[]> = {
  'General Practice': ['Family Medicine', 'Internal Medicine', 'General Practice'],
  Psychiatry: ['Psychiatry', 'Clinical Psychology', 'Behavioral Health'],
  'Physical Therapy': ['Physical Therapy', 'Sports Medicine', 'Rehabilitation'],
  Dermatology: ['Dermatology', 'Cosmetic Dermatology', 'Skin Cancer'],
  Cardiology: ['Cardiology', 'Interventional Cardiology', 'Heart Failure'],
};

const PRACTICES_DATA = [
  {
    name: 'City Health Clinic',
    category: 'General Practice',
    description: 'Comprehensive primary care for the whole family. Walk-ins and telehealth available.',
    timezone: 'America/New_York',
  },
  {
    name: 'Mind & Body Wellness',
    category: 'Psychiatry',
    description: 'Mental health services including therapy, medication management, and wellness coaching.',
    timezone: 'America/Chicago',
  },
  {
    name: 'Peak Performance PT',
    category: 'Physical Therapy',
    description: 'Sports rehabilitation, injury recovery, and preventive care for active lifestyles.',
    timezone: 'America/Los_Angeles',
  },
  {
    name: 'Clear Skin Dermatology',
    category: 'Dermatology',
    description: 'Medical and cosmetic dermatology. Skin cancer screening, acne treatment, and more.',
    timezone: 'America/Denver',
  },
  {
    name: 'HeartFirst Cardiology',
    category: 'Cardiology',
    description: 'Advanced cardiac care with a focus on prevention, diagnostics, and treatment.',
    timezone: 'America/New_York',
  },
];

const SERVICES_BY_CATEGORY: Record<string, Array<{ name: string; duration: number; price: number; type: string }>> = {
  'General Practice': [
    { name: 'Initial Consultation', duration: 30, price: 150, type: 'VIDEO' },
    { name: 'Follow-Up Visit', duration: 15, price: 75, type: 'VIDEO' },
    { name: 'Annual Physical', duration: 60, price: 250, type: 'IN_PERSON' },
    { name: 'Sick Visit', duration: 20, price: 100, type: 'BOTH' },
  ],
  Psychiatry: [
    { name: 'Initial Psychiatric Evaluation', duration: 60, price: 300, type: 'VIDEO' },
    { name: 'Medication Management', duration: 20, price: 150, type: 'VIDEO' },
    { name: 'Therapy Session', duration: 50, price: 200, type: 'VIDEO' },
    { name: 'Crisis Consultation', duration: 30, price: 175, type: 'PHONE' },
  ],
  'Physical Therapy': [
    { name: 'Initial Assessment', duration: 60, price: 175, type: 'IN_PERSON' },
    { name: 'Treatment Session', duration: 45, price: 125, type: 'IN_PERSON' },
    { name: 'Virtual PT Session', duration: 30, price: 100, type: 'VIDEO' },
    { name: 'Sports Injury Consult', duration: 30, price: 150, type: 'BOTH' },
  ],
  Dermatology: [
    { name: 'Skin Check', duration: 30, price: 200, type: 'VIDEO' },
    { name: 'Acne Consultation', duration: 20, price: 150, type: 'VIDEO' },
    { name: 'Mole Removal Consult', duration: 15, price: 100, type: 'IN_PERSON' },
  ],
  Cardiology: [
    { name: 'Cardiac Consultation', duration: 45, price: 350, type: 'IN_PERSON' },
    { name: 'Follow-Up Review', duration: 20, price: 175, type: 'VIDEO' },
    { name: 'Stress Test Consult', duration: 30, price: 200, type: 'IN_PERSON' },
  ],
};

const INTAKE_TEMPLATE = {
  name: 'Standard Intake Form',
  description: 'Basic patient information and medical history',
  fields: [
    { id: 'allergies', label: 'Known Allergies', type: 'textarea', required: false },
    { id: 'medications', label: 'Current Medications', type: 'textarea', required: false },
    { id: 'conditions', label: 'Existing Medical Conditions', type: 'textarea', required: false },
    { id: 'reason', label: 'Reason for Visit', type: 'textarea', required: true },
    { id: 'emergency_contact', label: 'Emergency Contact Name & Phone', type: 'text', required: false },
  ],
};

const CANCELLATION_REASONS = [
  'Schedule conflict',
  'Feeling better',
  'Financial reasons',
  'Found another provider',
  'Personal emergency',
];

const NOTES_SAMPLES = [
  'Patient presents with mild symptoms. Recommended follow-up in 2 weeks.',
  'Discussed treatment options. Prescribed medication. Will monitor progress.',
  'Good progress since last visit. Continue current treatment plan.',
  'New symptoms reported. Ordered additional tests for evaluation.',
  'Annual checkup complete. All vitals within normal range.',
  'Referred to specialist for further evaluation.',
  'Patient reports improvement with current medication regimen.',
  'Reviewed lab results. Adjusting dosage as needed.',
];

// ─── Main Seed Function ─────────────────────────────────

async function main() {
  console.log('🌱 Starting MedConnect seed...\n');

  // Clear existing data (in reverse dependency order)
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.appointmentReminder.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.message.deleteMany();
  await prisma.intakeSubmission.deleteMany();
  await prisma.intakeFormTemplate.deleteMany();
  await prisma.videoParticipant.deleteMany();
  await prisma.videoRoom.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slotReservation.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.service.deleteMany();
  await prisma.invitationToken.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.practice.deleteMany();
  await prisma.user.deleteMany();

  // ─── Create Users ──────────────────────────────────────

  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Demo123!', 12);

  // 15 provider users + 5 owner users (one per practice)
  const ownerUsers: any[] = [];
  const providerUsers: any[] = [];
  const patientUsers: any[] = [];

  for (let i = 0; i < 5; i++) {
    const first = FIRST_NAMES[i];
    const last = LAST_NAMES[i];
    ownerUsers.push({
      id: uuid(),
      email: `${first.toLowerCase()}.${last.toLowerCase()}@medconnect-demo.com`,
      password_hash: passwordHash,
      name: `Dr. ${first} ${last}`,
      role: 'USER' as const,
      email_verified: true,
    });
  }

  for (let i = 5; i < 20; i++) {
    const first = FIRST_NAMES[i];
    const last = LAST_NAMES[i];
    providerUsers.push({
      id: uuid(),
      email: `${first.toLowerCase()}.${last.toLowerCase()}@medconnect-demo.com`,
      password_hash: passwordHash,
      name: `Dr. ${first} ${last}`,
      role: 'USER' as const,
      email_verified: true,
    });
  }

  for (let i = 0; i < 50; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i + 7) % LAST_NAMES.length];
    const suffix = i > 0 ? i : '';
    patientUsers.push({
      id: uuid(),
      email: `patient.${first.toLowerCase()}${suffix}@synthea-demo.com`,
      password_hash: passwordHash,
      name: `${first} ${last}`,
      role: 'USER' as const,
      email_verified: true,
      date_of_birth: new Date(1950 + randomInt(0, 55), randomInt(0, 11), randomInt(1, 28)),
      gender: randomItem(['Male', 'Female', 'Other', 'Prefer not to say']),
    });
  }

  await prisma.user.createMany({
    data: [...ownerUsers, ...providerUsers, ...patientUsers],
  });
  console.log(`  Created ${ownerUsers.length} owners, ${providerUsers.length} providers, ${patientUsers.length} patients`);

  // ─── Create Practices ─────────────────────────────────

  console.log('Creating practices...');
  const practices: any[] = [];

  for (let i = 0; i < PRACTICES_DATA.length; i++) {
    const pd = PRACTICES_DATA[i];
    practices.push({
      id: uuid(),
      name: pd.name,
      slug: slugify(pd.name),
      description: pd.description,
      category: pd.category,
      timezone: pd.timezone,
      is_published: true,
      contact_email: `info@${slugify(pd.name)}.demo`,
      contact_phone: `(555) ${String(100 + i).padStart(3, '0')}-${String(1000 + i * 111).slice(0, 4)}`,
      default_cancellation_policy: { hours: 24, fee_percentage: 50 },
      stripe_onboarded: true,
      stripe_account_id: `acct_demo_${i}`,
    });
  }

  await prisma.practice.createMany({ data: practices });

  // ─── Create Memberships + Provider Profiles ────────────

  console.log('Creating memberships and provider profiles...');
  const providerProfiles: any[] = [];

  for (let i = 0; i < practices.length; i++) {
    const practice = practices[i];
    const owner = ownerUsers[i];

    // Owner membership
    await prisma.tenantMembership.create({
      data: { id: uuid(), practice_id: practice.id, user_id: owner.id, role: 'OWNER' },
    });

    // Owner provider profile
    const ownerProfile = {
      id: uuid(),
      practice_id: practice.id,
      user_id: owner.id,
      specialties: PROVIDER_SPECIALTIES[practice.category] || [practice.category],
      credentials: 'MD, Board Certified',
      bio: `Experienced ${practice.category.toLowerCase()} provider with over 15 years in practice.`,
      years_of_experience: randomInt(10, 25),
      consultation_types: ['VIDEO', 'IN_PERSON'] as any[],
    };
    providerProfiles.push(ownerProfile);

    // 2 additional providers per practice
    const additionalProviders = providerUsers.slice(i * 2, i * 2 + 2);
    for (const pUser of additionalProviders) {
      await prisma.tenantMembership.create({
        data: { id: uuid(), practice_id: practice.id, user_id: pUser.id, role: 'PROVIDER' },
      });

      const profile = {
        id: uuid(),
        practice_id: practice.id,
        user_id: pUser.id,
        specialties: [randomItem(PROVIDER_SPECIALTIES[practice.category] || [practice.category])],
        credentials: randomItem(['MD', 'DO', 'NP', 'PA', 'PhD', 'PsyD', 'DPT']),
        bio: `Dedicated healthcare professional specializing in ${practice.category.toLowerCase()}.`,
        years_of_experience: randomInt(3, 20),
        consultation_types: ['VIDEO'] as any[],
      };
      providerProfiles.push(profile);
    }
  }

  await prisma.providerProfile.createMany({ data: providerProfiles });

  // ─── Create Availability Rules ─────────────────────────

  console.log('Creating availability rules...');
  const availabilityRules: any[] = [];

  for (const pp of providerProfiles) {
    // Mon-Fri availability
    for (let day = 1; day <= 5; day++) {
      availabilityRules.push({
        id: uuid(),
        practice_id: pp.practice_id,
        provider_profile_id: pp.id,
        day_of_week: day,
        start_time: new Date('2000-01-01T09:00:00'),
        end_time: new Date('2000-01-01T17:00:00'),
        slot_duration_minutes: 30,
      });
    }
  }

  await prisma.availabilityRule.createMany({ data: availabilityRules });

  // ─── Create Services ───────────────────────────────────

  console.log('Creating services...');
  const services: any[] = [];
  const serviceProviders: any[] = [];

  for (const practice of practices) {
    const categoryServices = SERVICES_BY_CATEGORY[practice.category] || SERVICES_BY_CATEGORY['General Practice'];
    const practiceProviders = providerProfiles.filter((pp) => pp.practice_id === practice.id);

    for (const svc of categoryServices) {
      const serviceId = uuid();
      services.push({
        id: serviceId,
        practice_id: practice.id,
        name: svc.name,
        description: `${svc.name} — ${svc.duration} minute ${svc.type.toLowerCase().replace('_', ' ')} session.`,
        duration_minutes: svc.duration,
        price: svc.price,
        consultation_type: svc.type as any,
      });

      // Link all practice providers to each service
      for (const pp of practiceProviders) {
        serviceProviders.push({
          id: uuid(),
          service_id: serviceId,
          provider_profile_id: pp.id,
        });
      }
    }
  }

  await prisma.service.createMany({ data: services });
  await prisma.serviceProvider.createMany({ data: serviceProviders });

  // ─── Create Intake Templates ───────────────────────────

  console.log('Creating intake templates...');
  const intakeTemplates: any[] = [];

  for (const practice of practices) {
    intakeTemplates.push({
      id: uuid(),
      practice_id: practice.id,
      name: INTAKE_TEMPLATE.name,
      description: INTAKE_TEMPLATE.description,
      fields: INTAKE_TEMPLATE.fields,
      is_system: true,
    });
  }

  await prisma.intakeFormTemplate.createMany({ data: intakeTemplates });

  // ─── Create Appointments ───────────────────────────────

  console.log('Creating appointments...');
  const appointments: any[] = [];
  const paymentRecords: any[] = [];
  const messages: any[] = [];
  const intakeSubmissions: any[] = [];
  const videoRooms: any[] = [];
  const notifications: any[] = [];

  const statuses: Array<{ status: string; weight: number }> = [
    { status: 'COMPLETED', weight: 40 },
    { status: 'CONFIRMED', weight: 20 },
    { status: 'PENDING', weight: 10 },
    { status: 'CANCELLED', weight: 15 },
    { status: 'NO_SHOW', weight: 8 },
    { status: 'IN_PROGRESS', weight: 7 },
  ];

  function weightedStatus(): string {
    const total = statuses.reduce((s, st) => s + st.weight, 0);
    let r = Math.random() * total;
    for (const st of statuses) {
      r -= st.weight;
      if (r <= 0) return st.status;
    }
    return 'COMPLETED';
  }

  let appointmentCount = 0;

  for (const practice of practices) {
    const practiceProviders = providerProfiles.filter((pp) => pp.practice_id === practice.id);
    const practiceServices = services.filter((s) => s.practice_id === practice.id);
    const template = intakeTemplates.find((t) => t.practice_id === practice.id);

    // ~40 appointments per practice
    for (let a = 0; a < 42; a++) {
      const provider = randomItem(practiceProviders);
      const service = randomItem(practiceServices);
      const patient = randomItem(patientUsers);
      const status = weightedStatus();

      // Past appointments for COMPLETED, CANCELLED, NO_SHOW
      // Future for PENDING, CONFIRMED
      // Today for IN_PROGRESS
      let startTime: Date;
      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
        startTime = pastDate(randomInt(1, 60), randomInt(9, 16));
      } else if (status === 'IN_PROGRESS') {
        const now = new Date();
        startTime = new Date(now.getTime() - 15 * 60000);
      } else {
        startTime = futureDate(randomInt(1, 30), randomInt(9, 16));
      }

      const endTime = addMinutes(startTime, service.duration_minutes);
      const consultType = service.consultation_type === 'BOTH'
        ? randomItem(['VIDEO', 'IN_PERSON'])
        : service.consultation_type;

      const appointmentId = uuid();
      const appointment: any = {
        id: appointmentId,
        practice_id: practice.id,
        provider_profile_id: provider.id,
        patient_id: patient.id,
        service_id: service.id,
        start_time: startTime,
        end_time: endTime,
        status: status as any,
        consultation_type: consultType as any,
      };

      if (status === 'COMPLETED') {
        appointment.checked_in_at = startTime;
        appointment.completed_at = endTime;
        appointment.notes = randomItem(NOTES_SAMPLES);
      } else if (status === 'CANCELLED') {
        appointment.cancellation_reason = randomItem(CANCELLATION_REASONS);
        appointment.cancelled_at = addMinutes(startTime, -randomInt(60, 1440));
        appointment.cancelled_by = randomItem([patient.id, provider.user_id]);
      } else if (status === 'NO_SHOW') {
        appointment.notes = 'Patient did not attend scheduled appointment.';
      } else if (status === 'IN_PROGRESS') {
        appointment.checked_in_at = startTime;
      }

      appointments.push(appointment);
      appointmentCount++;

      // Payment for non-free services
      if (Number(service.price) > 0) {
        const paymentStatus =
          status === 'CANCELLED' ? 'REFUNDED' :
          status === 'PENDING' ? 'PENDING' :
          'SUCCEEDED';
        const amount = Number(service.price);

        paymentRecords.push({
          id: uuid(),
          practice_id: practice.id,
          appointment_id: appointmentId,
          amount,
          status: paymentStatus as any,
          stripe_payment_intent_id: `pi_demo_${appointmentCount}`,
          platform_fee: Math.round(amount * 0.01 * 100) / 100,
          refund_amount: paymentStatus === 'REFUNDED' ? amount : null,
          refunded_at: paymentStatus === 'REFUNDED' ? appointment.cancelled_at : null,
        });
      }

      // Messages for completed/in-progress appointments (2-4 messages each)
      if (['COMPLETED', 'IN_PROGRESS', 'CONFIRMED'].includes(status) && Math.random() > 0.4) {
        const msgCount = randomInt(2, 4);
        for (let m = 0; m < msgCount; m++) {
          const isPatient = m % 2 === 0;
          messages.push({
            id: uuid(),
            practice_id: practice.id,
            appointment_id: appointmentId,
            sender_id: isPatient ? patient.id : provider.user_id,
            type: 'TEXT' as const,
            content: isPatient
              ? randomItem([
                  'Hi, I have a question about my appointment.',
                  'Could you send me the preparation instructions?',
                  'Thank you for the consultation!',
                  'Is there anything I should prepare before the visit?',
                ])
              : randomItem([
                  'Hello! Happy to help. What questions do you have?',
                  'Please make sure to fast for 8 hours before the appointment.',
                  'Your results look great. See you at the follow-up.',
                  'No special preparation needed. See you at your appointment!',
                ]),
            read_at: Math.random() > 0.3 ? addMinutes(startTime, randomInt(-120, 120)) : null,
            created_at: addMinutes(startTime, -randomInt(60, 1440) + m * 30),
          });
        }
      }

      // Intake submissions for some completed appointments
      if (['COMPLETED', 'IN_PROGRESS'].includes(status) && template && Math.random() > 0.3) {
        intakeSubmissions.push({
          id: uuid(),
          practice_id: practice.id,
          appointment_id: appointmentId,
          template_id: template.id,
          form_data: {
            allergies: randomItem(['None known', 'Penicillin', 'Shellfish', 'Latex', '']),
            medications: randomItem(['None', 'Lisinopril 10mg daily', 'Metformin 500mg BID', '']),
            conditions: randomItem(['None', 'Hypertension', 'Type 2 Diabetes', 'Asthma', '']),
            reason: randomItem([
              'Annual checkup',
              'New symptoms',
              'Follow-up on test results',
              'Medication review',
              'Persistent headaches',
            ]),
            emergency_contact: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)} - (555) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,
          },
          status: 'COMPLETED' as const,
          completed_at: addMinutes(startTime, -randomInt(60, 2880)),
        });
      }

      // Video rooms for video appointments that are confirmed/in-progress/completed
      if (consultType === 'VIDEO' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
        const roomStatus =
          status === 'COMPLETED' ? 'COMPLETED' :
          status === 'IN_PROGRESS' ? 'IN_PROGRESS' :
          'CREATED';

        videoRooms.push({
          id: uuid(),
          practice_id: practice.id,
          appointment_id: appointmentId,
          twilio_room_sid: `RM_demo_${appointmentCount}`,
          twilio_room_name: `room_${appointmentId.slice(0, 8)}`,
          status: roomStatus as any,
          started_at: ['IN_PROGRESS', 'COMPLETED'].includes(status) ? startTime : null,
          ended_at: status === 'COMPLETED' ? endTime : null,
          actual_duration_seconds:
            status === 'COMPLETED' ? service.duration_minutes * 60 - randomInt(0, 300) : null,
        });
      }

      // Notifications for patients
      if (['CONFIRMED', 'COMPLETED'].includes(status)) {
        notifications.push({
          id: uuid(),
          user_id: patient.id,
          practice_id: practice.id,
          type: status === 'CONFIRMED' ? 'APPOINTMENT_CONFIRMED' : 'APPOINTMENT_COMPLETED',
          title: status === 'CONFIRMED' ? 'Appointment Confirmed' : 'Appointment Completed',
          body: status === 'CONFIRMED'
            ? `Your appointment with ${provider.user_id === ownerUsers[0]?.id ? 'your provider' : 'your provider'} on ${startTime.toLocaleDateString()} has been confirmed.`
            : `Your appointment on ${startTime.toLocaleDateString()} has been completed. Thank you!`,
          data: { appointment_id: appointmentId },
          read_at: Math.random() > 0.5 ? addMinutes(startTime, randomInt(0, 60)) : null,
          created_at: status === 'CONFIRMED' ? addMinutes(startTime, -randomInt(60, 1440)) : endTime,
        });
      }
    }
  }

  // Batch insert all the generated data
  await prisma.appointment.createMany({ data: appointments });
  console.log(`  Created ${appointments.length} appointments`);

  await prisma.paymentRecord.createMany({ data: paymentRecords });
  console.log(`  Created ${paymentRecords.length} payment records`);

  await prisma.message.createMany({ data: messages });
  console.log(`  Created ${messages.length} messages`);

  await prisma.intakeSubmission.createMany({ data: intakeSubmissions });
  console.log(`  Created ${intakeSubmissions.length} intake submissions`);

  await prisma.videoRoom.createMany({ data: videoRooms });
  console.log(`  Created ${videoRooms.length} video rooms`);

  await prisma.notification.createMany({ data: notifications });
  console.log(`  Created ${notifications.length} notifications`);

  // ─── Create Consent Records ────────────────────────────

  console.log('Creating consent records...');
  const consentRecords: any[] = [];
  const seenPatients = new Set<string>();

  for (const appt of appointments) {
    if (!seenPatients.has(appt.patient_id)) {
      seenPatients.add(appt.patient_id);
      consentRecords.push({
        id: uuid(),
        user_id: appt.patient_id,
        type: 'DATA_PROCESSING',
        version: '1.0',
        consented_at: addMinutes(appt.created_at || new Date(), -5),
        ip_address: `192.168.${randomInt(1, 254)}.${randomInt(1, 254)}`,
      });
    }
  }

  await prisma.consentRecord.createMany({ data: consentRecords });
  console.log(`  Created ${consentRecords.length} consent records`);

  // ─── Create Blocked Dates ──────────────────────────────

  console.log('Creating blocked dates...');
  const blockedDates: any[] = [];

  // A few providers have upcoming blocked dates (vacations)
  for (let i = 0; i < 5; i++) {
    const pp = providerProfiles[randomInt(0, providerProfiles.length - 1)];
    const start = futureDate(randomInt(14, 45), 0);
    const end = new Date(start);
    end.setDate(end.getDate() + randomInt(1, 5));
    blockedDates.push({
      id: uuid(),
      practice_id: pp.practice_id,
      provider_profile_id: pp.id,
      start_date: start,
      end_date: end,
      reason: randomItem(['Vacation', 'Conference', 'Personal', 'Holiday']),
    });
  }

  await prisma.blockedDate.createMany({ data: blockedDates });
  console.log(`  Created ${blockedDates.length} blocked dates`);

  // ─── Create Audit Logs ─────────────────────────────────

  console.log('Creating audit logs...');
  const auditLogs: any[] = [];

  for (const appt of appointments.slice(0, 50)) {
    auditLogs.push({
      id: uuid(),
      user_id: appt.patient_id,
      practice_id: appt.practice_id,
      action: 'APPOINTMENT_CREATED',
      resource_type: 'appointment',
      resource_id: appt.id,
      metadata: { status: appt.status },
      created_at: appt.start_time,
    });

    if (appt.status === 'COMPLETED' || appt.status === 'CANCELLED') {
      auditLogs.push({
        id: uuid(),
        user_id: appt.patient_id,
        practice_id: appt.practice_id,
        action: appt.status === 'COMPLETED' ? 'APPOINTMENT_COMPLETED' : 'APPOINTMENT_CANCELLED',
        resource_type: 'appointment',
        resource_id: appt.id,
        metadata: { status: appt.status },
        created_at: appt.completed_at || appt.cancelled_at || appt.start_time,
      });
    }
  }

  await prisma.auditLog.createMany({ data: auditLogs });
  console.log(`  Created ${auditLogs.length} audit logs`);

  // ─── Summary ───────────────────────────────────────────

  console.log('\n✅ Seed complete!\n');
  console.log('Summary:');
  console.log(`  Practices: ${practices.length}`);
  console.log(`  Users: ${ownerUsers.length + providerUsers.length + patientUsers.length} (${ownerUsers.length} owners, ${providerUsers.length} providers, ${patientUsers.length} patients)`);
  console.log(`  Provider Profiles: ${providerProfiles.length}`);
  console.log(`  Services: ${services.length}`);
  console.log(`  Availability Rules: ${availabilityRules.length}`);
  console.log(`  Appointments: ${appointments.length}`);
  console.log(`  Payment Records: ${paymentRecords.length}`);
  console.log(`  Messages: ${messages.length}`);
  console.log(`  Video Rooms: ${videoRooms.length}`);
  console.log(`  Notifications: ${notifications.length}`);
  console.log('\nDemo login: any patient email with password "Demo123!"');
  console.log('Example: patient.james@synthea-demo.com / Demo123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
