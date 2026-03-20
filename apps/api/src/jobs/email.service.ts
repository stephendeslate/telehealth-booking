import { Injectable, Logger } from '@nestjs/common';

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
 * Mock email service. Logs emails to console instead of sending.
 * Replace with Resend in Phase 10.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sentEmails: EmailResult[] = [];

  async send(options: EmailOptions): Promise<EmailResult> {
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
