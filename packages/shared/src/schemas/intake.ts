import { z } from 'zod';
import { IntakeFieldType, IntakeStatus } from '../enums';

const intakeFieldSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(IntakeFieldType),
  label: z.string(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const createIntakeTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  fields: z.array(intakeFieldSchema).min(1),
  is_active: z.boolean().default(true),
});

export const updateIntakeTemplateSchema = createIntakeTemplateSchema.partial();

export const submitIntakeSchema = z.object({
  form_data: z.record(z.unknown()),
});

export const intakeTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  practice_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  fields: z.array(intakeFieldSchema),
  is_system: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const intakeSubmissionResponseSchema = z.object({
  id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  template_id: z.string().uuid(),
  form_data: z.record(z.unknown()),
  status: z.nativeEnum(IntakeStatus),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type IntakeField = z.infer<typeof intakeFieldSchema>;
export type CreateIntakeTemplateDto = z.infer<typeof createIntakeTemplateSchema>;
export type UpdateIntakeTemplateDto = z.infer<typeof updateIntakeTemplateSchema>;
export type SubmitIntakeDto = z.infer<typeof submitIntakeSchema>;
export type IntakeTemplateResponse = z.infer<typeof intakeTemplateResponseSchema>;
export type IntakeSubmissionResponse = z.infer<typeof intakeSubmissionResponseSchema>;
