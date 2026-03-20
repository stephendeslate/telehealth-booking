import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentsController, StripeWebhookController } from './payments.controller';

@Module({
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentsModule {}
