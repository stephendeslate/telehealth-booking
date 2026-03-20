import { z } from 'zod';
import { CalendarProvider, CalendarConnectionStatus } from '../enums';

export const connectCalendarSchema = z.object({
  provider: z.nativeEnum(CalendarProvider),
  auth_code: z.string(),
  redirect_uri: z.string().url(),
});

export const calendarConnectionResponseSchema = z.object({
  id: z.string().uuid(),
  provider: z.nativeEnum(CalendarProvider),
  status: z.nativeEnum(CalendarConnectionStatus),
  calendar_id: z.string().nullable(),
  last_synced_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type ConnectCalendarDto = z.infer<typeof connectCalendarSchema>;
export type CalendarConnectionResponse = z.infer<typeof calendarConnectionResponseSchema>;
