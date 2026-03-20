import { z } from 'zod';
import { MessageType } from '../enums';

export const sendMessageSchema = z.object({
  appointment_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export const markReadSchema = z.object({
  message_id: z.string().uuid(),
});

export const messageResponseSchema = z.object({
  id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  sender_id: z.string().uuid().nullable(),
  type: z.nativeEnum(MessageType),
  content: z.string(),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  sender: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      avatar_url: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type MarkReadDto = z.infer<typeof markReadSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
