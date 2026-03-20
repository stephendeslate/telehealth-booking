import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  id: string;
  to: string;
  subject: string;
}

/**
 * Email service with Resend integration.
 * Uses Resend SDK when RESEND_API_KEY is set, otherwise falls back to mock (console logging).
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly sentEmails: EmailResult[] = [];
  private resend: any = null;
  private fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromEmail = this.config.get<string>('FROM_EMAIL', 'noreply@medconnect.local');
  }

  async onModuleInit() {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      try {
        const { Resend } = await import('resend');
        this.resend = new Resend(apiKey);
        this.logger.log('Resend email transport initialized');
      } catch (err) {
        this.logger.warn('Resend package not installed — falling back to mock email transport');
      }
    } else {
      this.logger.log('RESEND_API_KEY not set — using mock email transport');
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const from = options.from || this.fromEmail;

    if (this.resend) {
      return this.sendViaResend(from, options);
    }

    return this.sendMock(options);
  }

  private async sendViaResend(from: string, options: EmailOptions): Promise<EmailResult> {
    const { data, error } = await this.resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      this.logger.error(`Resend error: ${error.message}`);
      throw new Error(`Email send failed: ${error.message}`);
    }

    const result: EmailResult = {
      id: data.id,
      to: options.to,
      subject: options.subject,
    };

    this.sentEmails.push(result);
    return result;
  }

  private async sendMock(options: EmailOptions): Promise<EmailResult> {
    const result: EmailResult = {
      id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: options.to,
      subject: options.subject,
    };

    this.logger.log(
      `[MOCK EMAIL] To: ${options.to} | Subject: ${options.subject}`,
    );

    this.sentEmails.push(result);
    return result;
  }

  /** For testing — returns all emails sent in this process */
  getSentEmails(): EmailResult[] {
    return [...this.sentEmails];
  }

  /** For testing — clear sent emails */
  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}
