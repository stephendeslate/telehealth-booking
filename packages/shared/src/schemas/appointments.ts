import { z } from 'zod';
import { AppointmentStatus, ConsultationType } from '../enums';

export const reserveSlotSchema = z.object({
  practice_id: z.string().uuid(),
  provider_profile_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
});

export const reserveSlotResponseSchema = z.object({
  reservation_id: z.string().uuid(),
  session_id: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export const createAppointmentSchema = z.object({
  practice_id: z.string().uuid(),
  provider_profile_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  consultation_type: z.nativeEnum(ConsultationType).optional(),
  reservation_session_id: z.string(),
  patient_name: z.string().min(1).max(255).optional(),
  patient_email: z.string().email().optional(),
  patient_phone: z.string().max(20).optional(),
  stripe_payment_method_id: z.string().optional(),
  data_processing_consent: z.literal(true, {
    errorMap: () => ({ message: 'Data processing consent is required' }),
  }),
  intake_data: z.record(z.unknown()).optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  new_start_time: z.string().datetime(),
  reservation_session_id: z.string(),
});

export const appointmentNotesSchema = z.object({
  notes: z.string().max(5000),
});

export const appointmentResponseSchema = z.object({
  id: z.string().uuid(),
  practice_id: z.string().uuid(),
  provider_profile_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: z.nativeEnum(AppointmentStatus),
  consultation_type: z.nativeEnum(ConsultationType),
  notes: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  cancelled_by: z.string().uuid().nullable(),
  cancelled_at: z.string().datetime().nullable(),
  checked_in_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  provider: z
    .object({
      id: z.string().uuid(),
      user: z.object({ name: z.string(), avatar_url: z.string().nullable() }),
      credentials: z.string().nullable(),
    })
    .optional(),
  patient: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
    })
    .optional(),
  service: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      duration_minutes: z.number(),
      price: z.number(),
    })
    .optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const availabilityQuerySchema = z.object({
  date: z.string().date(),
  service_id: z.string().uuid(),
});

export const availabilityResponseSchema = z.object({
  provider_id: z.string().uuid(),
  date: z.string().date(),
  timezone: z.string(),
  slots: z.array(
    z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
  ),
});

export const appointmentListQuerySchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReserveSlotDto = z.infer<typeof reserveSlotSchema>;
export type ReserveSlotResponse = z.infer<typeof reserveSlotResponseSchema>;
export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type CancelAppointmentDto = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentDto = z.infer<typeof rescheduleAppointmentSchema>;
export type AppointmentNotesDto = z.infer<typeof appointmentNotesSchema>;
export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;
