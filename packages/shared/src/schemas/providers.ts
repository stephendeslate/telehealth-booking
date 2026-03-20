import { z } from 'zod';
import { ConsultationType, MembershipRole } from '../enums';

export const createProviderProfileSchema = z.object({
  specialties: z.array(z.string()).default([]),
  credentials: z.string().max(100).optional(),
  bio: z.string().optional(),
  years_of_experience: z.number().int().min(0).optional(),
  education: z.string().optional(),
  languages: z.array(z.string()).default(['English']),
  accepting_new_patients: z.boolean().default(true),
  consultation_types: z.array(z.nativeEnum(ConsultationType)).default([ConsultationType.VIDEO]),
});

export const updateProviderProfileSchema = createProviderProfileSchema.partial();

export const providerProfileResponseSchema = z.object({
  id: z.string().uuid(),
  practice_id: z.string().uuid(),
  user_id: z.string().uuid(),
  user: z.object({
    name: z.string(),
    email: z.string(),
    avatar_url: z.string().nullable(),
  }),
  specialties: z.array(z.string()),
  credentials: z.string().nullable(),
  bio: z.string().nullable(),
  years_of_experience: z.number().nullable(),
  education: z.string().nullable(),
  languages: z.array(z.string()),
  accepting_new_patients: z.boolean(),
  consultation_types: z.array(z.nativeEnum(ConsultationType)),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const inviteProviderSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.PROVIDER),
});

export const verifyInvitationSchema = z.object({
  token: z.string().min(1),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export const availabilityRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:mm'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:mm'),
  slot_duration_minutes: z.number().int().min(5).max(480),
  is_active: z.boolean().default(true),
});

export const createAvailabilityRulesSchema = z.object({
  rules: z.array(availabilityRuleSchema).min(1),
});

export const blockedDateSchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
  reason: z.string().max(255).optional(),
});

export const createBlockedDatesSchema = z.object({
  dates: z.array(blockedDateSchema).min(1),
});

export type CreateProviderProfileDto = z.infer<typeof createProviderProfileSchema>;
export type UpdateProviderProfileDto = z.infer<typeof updateProviderProfileSchema>;
export type ProviderProfileResponse = z.infer<typeof providerProfileResponseSchema>;
export type InviteProviderDto = z.infer<typeof inviteProviderSchema>;
export type AvailabilityRuleDto = z.infer<typeof availabilityRuleSchema>;
export type BlockedDateDto = z.infer<typeof blockedDateSchema>;
