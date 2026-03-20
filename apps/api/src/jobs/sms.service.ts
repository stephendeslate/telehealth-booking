import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsOptions {
  to: string;
  body: string;
}

export interface SmsResult {
  id: string;
  to: string;
  body: string;
}

/**
 * SMS service with Twilio integration.
 * Uses Twilio SDK when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set,
 * otherwise falls back to mock (console logging).
 */
@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private readonly sentMessages: SmsResult[] = [];
  private twilioClient: any = null;
  private fromNumber: string | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const phoneNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');

    if (accountSid && authToken && phoneNumber) {
      try {
        const twilio = await import('twilio');
        this.twilioClient = twilio.default(accountSid, authToken);
        this.fromNumber = phoneNumber;
        this.logger.log('Twilio SMS transport initialized');
      } catch {
        this.logger.warn('Twilio package not installed — falling back to mock SMS transport');
      }
    } else {
      this.logger.log('Twilio SMS credentials not set — using mock SMS transport');
    }
  }

  async send(options: SmsOptions): Promise<SmsResult> {
    if (this.twilioClient && this.fromNumber) {
      return this.sendViaTwilio(options);
    }
    return this.sendMock(options);
  }

  private async sendViaTwilio(options: SmsOptions): Promise<SmsResult> {
    const message = await this.twilioClient.messages.create({
      body: options.body,
      from: this.fromNumber,
      to: options.to,
    });

    const result: SmsResult = {
      id: message.sid,
      to: options.to,
      body: options.body,
    };

    this.sentMessages.push(result);
    return result;
  }

  private async sendMock(options: SmsOptions): Promise<SmsResult> {
    const result: SmsResult = {
      id: `mock_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: options.to,
      body: options.body,
    };

    this.logger.log(
      `[MOCK SMS] To: ${options.to} | Body: ${options.body.slice(0, 80)}${options.body.length > 80 ? '...' : ''}`,
    );

    this.sentMessages.push(result);
    return result;
  }

  /** For testing — returns all SMS sent in this process */
  getSentMessages(): SmsResult[] {
    return [...this.sentMessages];
  }

  /** For testing — clear sent messages */
  clearSentMessages(): void {
    this.sentMessages.length = 0;
  }
}
