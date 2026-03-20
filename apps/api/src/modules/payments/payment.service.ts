import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, PaymentFailedError } from '../../common/errors/app-error';
import { AuditAction, PLATFORM_FEE_PERCENT } from '@medconnect/shared';

/**
 * Payment service with Stripe Connect integration.
 * Uses Stripe SDK when STRIPE_SECRET_KEY is set, otherwise falls back to mock.
 */
@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      try {
        const Stripe = (await import('stripe')).default;
        this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
        this.logger.log('Stripe payment service initialized');
      } catch (err) {
        this.logger.warn('Stripe package not installed — falling back to mock payments');
      }
    } else {
      this.logger.log('STRIPE_SECRET_KEY not set — using mock payment service');
    }
  }

  /**
   * Create a payment intent for an appointment.
   * Uses Stripe when configured, otherwise creates a mock succeeded payment immediately.
   */
  async createPaymentIntent(opts: {
    practiceId: string;
    appointmentId: string;
    amount: number;
    currency?: string;
    userId?: string;
    stripeConnectedAccountId?: string;
  }) {
    const { practiceId, appointmentId, amount, currency = 'USD', userId } = opts;
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100;

    if (this.stripe && opts.stripeConnectedAccountId) {
      return this.createStripePaymentIntent(opts, platformFee);
    }

    return this.createMockPaymentIntent(opts, platformFee);
  }

  private async createStripePaymentIntent(
    opts: {
      practiceId: string;
      appointmentId: string;
      amount: number;
      currency?: string;
      userId?: string;
      stripeConnectedAccountId?: string;
    },
    platformFee: number,
  ) {
    const { practiceId, appointmentId, amount, currency = 'USD', userId } = opts;
    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(platformFee * 100);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: opts.stripeConnectedAccountId,
        },
        metadata: {
          appointment_id: appointmentId,
          practice_id: practiceId,
        },
      });

      const payment = await this.prisma.paymentRecord.create({
        data: {
          practice_id: practiceId,
          appointment_id: appointmentId,
          amount,
          currency,
          status: 'PENDING',
          stripe_payment_intent_id: paymentIntent.id,
          platform_fee: platformFee,
          metadata: {
            appointment_id: appointmentId,
            practice_id: practiceId,
            client_secret: paymentIntent.client_secret,
          },
        },
      });

      await this.audit.log({
        user_id: userId,
        practice_id: practiceId,
        action: AuditAction.PAYMENT_CREATED,
        resource_type: 'payment',
        resource_id: payment.id,
        metadata: { amount, currency } as any,
      });

      this.logger.log(`Stripe PaymentIntent created: ${paymentIntent.id} ($${amount})`);

      return {
        ...this.formatPayment(payment),
        client_secret: paymentIntent.client_secret,
      };
    } catch (err: any) {
      this.logger.error(`Stripe PaymentIntent failed: ${err.message}`);
      throw new PaymentFailedError(err.message);
    }
  }

  private async createMockPaymentIntent(
    opts: {
      practiceId: string;
      appointmentId: string;
      amount: number;
      currency?: string;
      userId?: string;
    },
    platformFee: number,
  ) {
    const { practiceId, appointmentId, amount, currency = 'USD', userId } = opts;
    const stripePaymentIntentId = `pi_mock_${randomBytes(12).toString('hex')}`;

    const payment = await this.prisma.paymentRecord.create({
      data: {
        practice_id: practiceId,
        appointment_id: appointmentId,
        amount,
        currency,
        status: 'SUCCEEDED',
        stripe_payment_intent_id: stripePaymentIntentId,
        platform_fee: platformFee,
        metadata: {
          appointment_id: appointmentId,
          practice_id: practiceId,
        },
      },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: practiceId,
      action: AuditAction.PAYMENT_CREATED,
      resource_type: 'payment',
      resource_id: payment.id,
      metadata: { amount, currency } as any,
    });

    this.logger.log(`[MOCK] Payment succeeded: ${stripePaymentIntentId} ($${amount})`);

    return this.formatPayment(payment);
  }

  /**
   * Process a refund for a payment.
   * Uses Stripe refund API when configured, otherwise updates DB directly.
   */
  async refund(opts: {
    paymentId: string;
    amount?: number;
    reason?: string;
    userId?: string;
  }) {
    const payment = await this.prisma.paymentRecord.findUnique({
      where: { id: opts.paymentId },
    });

    if (!payment) throw new NotFoundError('Payment', opts.paymentId);

    if (payment.status !== 'SUCCEEDED') {
      throw new Error(`Cannot refund payment with status ${payment.status}`);
    }

    const refundAmount = opts.amount ?? Number(payment.amount);
    const isFullRefund = refundAmount >= Number(payment.amount);

    // Issue Stripe refund if using real Stripe and the PI is real (not mock)
    if (this.stripe && payment.stripe_payment_intent_id && !payment.stripe_payment_intent_id.startsWith('pi_mock_')) {
      try {
        await this.stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: opts.reason === 'duplicate' ? 'duplicate' : opts.reason === 'fraudulent' ? 'fraudulent' : 'requested_by_customer',
        });
        this.logger.log(`Stripe refund issued: $${refundAmount} for PI ${payment.stripe_payment_intent_id}`);
      } catch (err: any) {
        this.logger.error(`Stripe refund failed: ${err.message}`);
        throw new PaymentFailedError(`Refund failed: ${err.message}`);
      }
    } else {
      this.logger.log(`[MOCK] Refund processed: $${refundAmount} for payment ${payment.id}`);
    }

    const updated = await this.prisma.paymentRecord.update({
      where: { id: opts.paymentId },
      data: {
        status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refund_amount: refundAmount,
        refunded_at: new Date(),
      },
    });

    await this.audit.log({
      user_id: opts.userId,
      practice_id: payment.practice_id,
      action: AuditAction.PAYMENT_REFUNDED,
      resource_type: 'payment',
      resource_id: payment.id,
      metadata: { refundAmount, reason: opts.reason } as any,
    });

    return this.formatPayment(updated);
  }

  /**
   * Get payment for an appointment.
   */
  async getByAppointment(appointmentId: string) {
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { appointment_id: appointmentId },
      orderBy: { created_at: 'desc' },
    });

    if (!payment) return null;
    return this.formatPayment(payment);
  }

  /**
   * List payments for a practice.
   */
  async listForPractice(
    practiceId: string,
    options: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, from, to, page = 1, limit = 20 } = options;

    const where: any = { practice_id: practiceId };
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          appointment: {
            select: {
              id: true,
              patient_id: true,
              start_time: true,
              patient: { select: { name: true, email: true } },
              service: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return {
      data: payments.map((p) => this.formatPayment(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List payment history for a patient.
   */
  async listForPatient(
    patientId: string,
    options: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 20 } = options;

    const where = {
      appointment: { patient_id: patientId },
    };

    const [payments, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          appointment: {
            select: {
              id: true,
              start_time: true,
              service: { select: { name: true } },
              practice: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return {
      data: payments.map((p) => this.formatPayment(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a payment by its Stripe PaymentIntent ID.
   */
  async findByStripePaymentIntentId(stripePaymentIntentId: string) {
    return this.prisma.paymentRecord.findFirst({
      where: { stripe_payment_intent_id: stripePaymentIntentId },
    });
  }

  /**
   * Update payment status (used by webhook handler).
   */
  async updatePaymentStatus(paymentId: string, status: string) {
    return this.prisma.paymentRecord.update({
      where: { id: paymentId },
      data: { status: status as any },
    });
  }

  private formatPayment(payment: any) {
    return {
      ...payment,
      amount: Number(payment.amount),
      platform_fee: payment.platform_fee ? Number(payment.platform_fee) : null,
      refund_amount: payment.refund_amount ? Number(payment.refund_amount) : null,
    };
  }
}
