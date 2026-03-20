import { z } from 'zod';
import { UserRole } from '../enums';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().nullable().optional(),
  date_of_birth: z.string().date().optional(),
  gender: z.string().max(20).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().optional(),
  notification_preferences: z
    .object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
    })
    .optional(),
});

export const userProfileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  email_verified: z.boolean(),
  date_of_birth: z.string().nullable(),
  gender: z.string().nullable(),
  locale: z.string(),
  timezone: z.string().nullable(),
  notification_preferences: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
  }),
  created_at: z.string().datetime(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
