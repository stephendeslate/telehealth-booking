import { z } from 'zod';

export const adminAnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const adminAnalyticsResponseSchema = z.object({
  total_appointments: z.number(),
  completed_appointments: z.number(),
  cancelled_appointments: z.number(),
  no_show_appointments: z.number(),
  total_revenue: z.number(),
  total_patients: z.number(),
  new_patients_period: z.number(),
  appointment_completion_rate: z.number(),
});

export const adminPatientListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminPaymentListQuerySchema = z.object({
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;
export type AdminAnalyticsResponse = z.infer<typeof adminAnalyticsResponseSchema>;
