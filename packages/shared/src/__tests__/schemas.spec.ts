import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createPracticeSchema,
  createServiceSchema,
  reserveSlotSchema,
  createAppointmentSchema,
  sendMessageSchema,
  createIntakeTemplateSchema,
  presignUploadSchema,
  updateProfileSchema,
} from '../schemas';

describe('Auth Schemas', () => {
  it('registerSchema validates correct input', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      terms_accepted: true,
      privacy_accepted: true,
    });
    expect(result.success).toBe(true);
  });

  it('registerSchema rejects short password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'short',
      name: 'Test User',
      terms_accepted: true,
      privacy_accepted: true,
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema rejects without terms', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      terms_accepted: false,
      privacy_accepted: true,
    });
    expect(result.success).toBe(false);
  });

  it('loginSchema validates correct input', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('loginSchema rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'notanemail',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('Practice Schemas', () => {
  it('createPracticeSchema validates correct input', () => {
    const result = createPracticeSchema.safeParse({
      name: 'Test Practice',
      slug: 'test-practice',
      category: 'PRIMARY_CARE',
    });
    expect(result.success).toBe(true);
  });

  it('createPracticeSchema rejects invalid slug', () => {
    const result = createPracticeSchema.safeParse({
      name: 'Test Practice',
      slug: 'INVALID SLUG',
      category: 'PRIMARY_CARE',
    });
    expect(result.success).toBe(false);
  });
});

describe('Service Schemas', () => {
  it('createServiceSchema validates correct input', () => {
    const result = createServiceSchema.safeParse({
      name: 'General Consultation',
      duration_minutes: 30,
      price: 99.99,
    });
    expect(result.success).toBe(true);
  });

  it('createServiceSchema rejects duration under 5 minutes', () => {
    const result = createServiceSchema.safeParse({
      name: 'Quick Check',
      duration_minutes: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe('Appointment Schemas', () => {
  it('reserveSlotSchema validates correct input', () => {
    const result = reserveSlotSchema.safeParse({
      practice_id: '550e8400-e29b-41d4-a716-446655440000',
      provider_profile_id: '550e8400-e29b-41d4-a716-446655440001',
      service_id: '550e8400-e29b-41d4-a716-446655440002',
      start_time: '2025-06-15T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('createAppointmentSchema requires data_processing_consent', () => {
    const result = createAppointmentSchema.safeParse({
      practice_id: '550e8400-e29b-41d4-a716-446655440000',
      provider_profile_id: '550e8400-e29b-41d4-a716-446655440001',
      service_id: '550e8400-e29b-41d4-a716-446655440002',
      start_time: '2025-06-15T10:00:00.000Z',
      reservation_session_id: 'session-123',
      data_processing_consent: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('Message Schema', () => {
  it('sendMessageSchema validates correct input', () => {
    const result = sendMessageSchema.safeParse({
      appointment_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello, doctor!',
    });
    expect(result.success).toBe(true);
  });

  it('sendMessageSchema rejects empty content', () => {
    const result = sendMessageSchema.safeParse({
      appointment_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('Intake Schema', () => {
  it('createIntakeTemplateSchema validates correct input', () => {
    const result = createIntakeTemplateSchema.safeParse({
      name: 'General Intake',
      fields: [
        { id: 'allergies', type: 'TEXT', label: 'Allergies', required: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('createIntakeTemplateSchema rejects empty fields', () => {
    const result = createIntakeTemplateSchema.safeParse({
      name: 'Empty Form',
      fields: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('Upload Schema', () => {
  it('presignUploadSchema validates correct input', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'avatar',
      filename: 'photo.jpg',
      content_type: 'image/jpeg',
      content_length: 500000,
    });
    expect(result.success).toBe(true);
  });
});

describe('User Schema', () => {
  it('updateProfileSchema validates partial update', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('updateProfileSchema accepts empty object', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
