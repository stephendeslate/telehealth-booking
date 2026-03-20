import { z } from 'zod';
import { PaymentStatus } from '../enums';

export const paymentRecordResponseSchema = z.object({
  id: z.string().uuid(),
  appointment_id: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  status: z.nativeEnum(PaymentStatus),
  platform_fee: z.number().nullable(),
  refund_amount: z.number().nullable(),
  refunded_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PaymentRecordResponse = z.infer<typeof paymentRecordResponseSchema>;
