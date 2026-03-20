import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Headers,
  UseGuards,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MembershipRole } from '@medconnect/shared';

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/payments')
@UseGuards(PracticeRolesGuard)
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'List payments for a practice' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async list(
    @Param('practiceId') practiceId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentService.listForPractice(practiceId, {
      status,
      from,
      to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}

/**
 * Stripe webhook controller.
 * Verifies webhook signatures when STRIPE_WEBHOOK_SECRET is set.
 */
@ApiTags('payments')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Handle Stripe webhook' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() body: any,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (webhookSecret && stripeKey && signature) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey);
        const rawBody = req.rawBody;

        if (!rawBody) {
          this.logger.warn('No raw body available for webhook signature verification');
          return { received: true };
        }

        const event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret,
        );

        await this.handleStripeEvent(event);
        return { received: true };
      } catch (err: any) {
        this.logger.error(`Webhook signature verification failed: ${err.message}`);
        return { received: false, error: 'Signature verification failed' };
      }
    }

    // Mock mode — log and acknowledge
    this.logger.log(`[MOCK] Received Stripe webhook: ${body?.type || 'unknown'}`);
    return { received: true };
  }

  private async handleStripeEvent(event: any) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        this.logger.log(`Payment succeeded: ${pi.id}`);
        // Update payment record status
        const payment = await this.paymentService.findByStripePaymentIntentId(pi.id);
        if (payment) {
          await this.paymentService.updatePaymentStatus(payment.id, 'SUCCEEDED');
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        this.logger.log(`Payment failed: ${pi.id}`);
        const payment = await this.paymentService.findByStripePaymentIntentId(pi.id);
        if (payment) {
          await this.paymentService.updatePaymentStatus(payment.id, 'FAILED');
        }
        break;
      }
      case 'charge.refunded': {
        this.logger.log(`Charge refunded: ${event.data.object.id}`);
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }
}
