import { z } from 'zod';
import { NotificationType } from '../enums';

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullable(),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export const notificationListQuerySchema = z.object({
  unread_only: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
