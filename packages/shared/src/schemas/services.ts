import { z } from 'zod';
import { ConsultationType, ConfirmationMode } from '../enums';

export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0).default(0),
  consultation_type: z.nativeEnum(ConsultationType).default(ConsultationType.VIDEO),
  confirmation_mode: z.nativeEnum(ConfirmationMode).default(ConfirmationMode.AUTO_CONFIRM),
  intake_form_template_id: z.string().uuid().nullable().optional(),
  max_participants: z.number().int().min(2).max(6).default(2),
  buffer_before_minutes: z.number().int().min(0).default(0),
  buffer_after_minutes: z.number().int().min(0).default(0),
  category: z.string().max(100).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  provider_ids: z.array(z.string().uuid()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const serviceResponseSchema = z.object({
  id: z.string().uuid(),
  practice_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number(),
  price: z.number(),
  consultation_type: z.nativeEnum(ConsultationType),
  confirmation_mode: z.nativeEnum(ConfirmationMode),
  intake_form_template_id: z.string().uuid().nullable(),
  max_participants: z.number(),
  buffer_before_minutes: z.number(),
  buffer_after_minutes: z.number(),
  category: z.string().nullable(),
  is_active: z.boolean(),
  sort_order: z.number(),
  providers: z
    .array(
      z.object({
        id: z.string().uuid(),
        user: z.object({ name: z.string(), avatar_url: z.string().nullable() }),
      }),
    )
    .optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
export type ServiceResponse = z.infer<typeof serviceResponseSchema>;
