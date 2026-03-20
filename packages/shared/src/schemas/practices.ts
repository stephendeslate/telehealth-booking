import { z } from 'zod';
import { SpecialtyCategory, ConfirmationMode } from '../enums';

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().max(2).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const cancellationPolicySchema = z.object({
  free_cancel_hours: z.number().int().min(0),
  late_cancel_fee_percent: z.number().min(0).max(100),
  no_refund_hours: z.number().int().min(0),
});

const reminderSettingsSchema = z.object({
  email_24h: z.boolean(),
  email_1h: z.boolean(),
  sms_1h: z.boolean(),
});

export const createPracticeSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  category: z.nativeEnum(SpecialtyCategory),
  timezone: z.string().default('America/New_York'),
  currency: z.string().max(3).default('USD'),
  country: z.string().max(2).default('US'),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
  address: addressSchema.optional(),
  default_cancellation_policy: cancellationPolicySchema.optional(),
  reminder_settings: reminderSettingsSchema.optional(),
});

export const updatePracticeSchema = createPracticeSchema.partial().omit({ slug: true });

export const practiceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  category: z.nativeEnum(SpecialtyCategory),
  logo_url: z.string().nullable(),
  cover_photo_url: z.string().nullable(),
  brand_color: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  country: z.string(),
  address: addressSchema.nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  is_published: z.boolean(),
  stripe_onboarded: z.boolean(),
  default_cancellation_policy: cancellationPolicySchema.nullable(),
  reminder_settings: reminderSettingsSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const practiceSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  logo_url: z.string().url().nullable().optional(),
  cover_photo_url: z.string().url().nullable().optional(),
  brand_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
  address: addressSchema.optional(),
  is_published: z.boolean().optional(),
  default_cancellation_policy: cancellationPolicySchema.optional(),
  reminder_settings: reminderSettingsSchema.optional(),
  default_confirmation_mode: z.nativeEnum(ConfirmationMode).optional(),
});

export type CreatePracticeDto = z.infer<typeof createPracticeSchema>;
export type UpdatePracticeDto = z.infer<typeof updatePracticeSchema>;
export type PracticeResponse = z.infer<typeof practiceResponseSchema>;
export type PracticeSettingsDto = z.infer<typeof practiceSettingsSchema>;
