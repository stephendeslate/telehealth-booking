import { z } from 'zod';
import { VideoRoomStatus } from '../enums';

export const videoTokenResponseSchema = z.object({
  token: z.string(),
  room_name: z.string(),
  expires_at: z.string().datetime(),
});

export const videoRoomResponseSchema = z.object({
  id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  status: z.nativeEnum(VideoRoomStatus),
  max_participants: z.number(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  actual_duration_seconds: z.number().nullable(),
});

export type VideoTokenResponse = z.infer<typeof videoTokenResponseSchema>;
export type VideoRoomResponse = z.infer<typeof videoRoomResponseSchema>;
