import { z } from 'zod';
import { UploadPurpose } from '../enums';

export const presignUploadSchema = z.object({
  purpose: z.nativeEnum(UploadPurpose),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1),
  content_length: z.number().int().positive(),
});

export const presignUploadResponseSchema = z.object({
  upload_url: z.string().url(),
  public_url: z.string().url(),
  expires_at: z.string().datetime(),
});

export type PresignUploadDto = z.infer<typeof presignUploadSchema>;
export type PresignUploadResponse = z.infer<typeof presignUploadResponseSchema>;
