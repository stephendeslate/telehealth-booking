/**
 * Email templates — simple HTML generators.
 * In Phase 10, these will be replaced with React Email components
 * rendered via @react-email/render. For now, plain HTML templates.
 */

interface BaseContext {
  practiceName: string;
  practiceLogoUrl?: string;
}

// ─── Auth Templates ─────────────────────────────────────

export function verifyEmailTemplate(ctx: BaseContext & {
  userName: string;
  verifyUrl: string;
}) {
  return {
    subject: `Verify your email — ${ctx.practiceName || 'MedConnect'}`,
    html: wrap(ctx, `
      <h2>Welcome, ${esc(ctx.userName)}!</h2>
      <p>Please verify your email address to get started.</p>
      <p><a href="${esc(ctx.verifyUrl)}" style="${btnStyle}">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    `),
  };
}

export function passwordResetTemplate(ctx: BaseContext & {
  userName: string;
  resetUrl: string;
}) {
  return {
    subject: 'Reset your password',
    html: wrap(ctx, `
      <h2>Password Reset</h2>
      <p>Hi ${esc(ctx.userName)}, we received a request to reset your password.</p>
      <p><a href="${esc(ctx.resetUrl)}" style="${btnStyle}">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  };
}

export function welcomeTemplate(ctx: BaseContext & {
  userName: string;
  loginUrl: string;
}) {
  return {
    subject: `Welcome to ${ctx.practiceName || 'MedConnect'}!`,
    html: wrap(ctx, `
      <h2>Your email has been verified!</h2>
      <p>Hi ${esc(ctx.userName)}, your account is now active.</p>
      <p><a href="${esc(ctx.loginUrl)}" style="${btnStyle}">Go to Dashboard</a></p>
    `),
  };
}

// ─── Appointment Templates ──────────────────────────────

export function appointmentConfirmedTemplate(ctx: BaseContext & {
  patientName: string;
  providerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: string;
  detailUrl: string;
}) {
  return {
    subject: `Appointment Confirmed — ${ctx.appointmentDate}`,
    html: wrap(ctx, `
      <h2>Appointment Confirmed</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Your appointment has been confirmed:</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Service:</td><td>${esc(ctx.serviceName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Provider:</td><td>${esc(ctx.providerName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ctx.appointmentDate)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Time:</td><td>${esc(ctx.appointmentTime)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Type:</td><td>${esc(ctx.consultationType)}</td></tr>
      </table>
      <p><a href="${esc(ctx.detailUrl)}" style="${btnStyle}">View Appointment</a></p>
    `),
  };
}

export function appointmentCancelledTemplate(ctx: BaseContext & {
  recipientName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  cancelledBy: string;
  reason?: string;
  rebookUrl: string;
}) {
  return {
    subject: `Appointment Cancelled — ${ctx.appointmentDate}`,
    html: wrap(ctx, `
      <h2>Appointment Cancelled</h2>
      <p>Hi ${esc(ctx.recipientName)},</p>
      <p>Your ${esc(ctx.serviceName)} appointment on ${esc(ctx.appointmentDate)} at ${esc(ctx.appointmentTime)} has been cancelled${ctx.cancelledBy ? ` by ${esc(ctx.cancelledBy)}` : ''}.</p>
      ${ctx.reason ? `<p>Reason: ${esc(ctx.reason)}</p>` : ''}
      <p><a href="${esc(ctx.rebookUrl)}" style="${btnStyle}">Book Again</a></p>
    `),
  };
}

export function appointmentRescheduledTemplate(ctx: BaseContext & {
  patientName: string;
  serviceName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  detailUrl: string;
}) {
  return {
    subject: `Appointment Rescheduled — ${ctx.newDate}`,
    html: wrap(ctx, `
      <h2>Appointment Rescheduled</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Your ${esc(ctx.serviceName)} appointment has been rescheduled:</p>
      <p><strong>From:</strong> ${esc(ctx.oldDate)} at ${esc(ctx.oldTime)}<br/>
         <strong>To:</strong> ${esc(ctx.newDate)} at ${esc(ctx.newTime)}</p>
      <p><a href="${esc(ctx.detailUrl)}" style="${btnStyle}">View Appointment</a></p>
    `),
  };
}

export function appointmentReminder24hTemplate(ctx: BaseContext & {
  patientName: string;
  providerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  detailUrl: string;
}) {
  return {
    subject: `Reminder: Appointment Tomorrow — ${ctx.appointmentTime}`,
    html: wrap(ctx, `
      <h2>Appointment Reminder</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>This is a reminder that you have an appointment tomorrow:</p>
      <p><strong>${esc(ctx.serviceName)}</strong> with ${esc(ctx.providerName)}<br/>
         ${esc(ctx.appointmentDate)} at ${esc(ctx.appointmentTime)}</p>
      <p><a href="${esc(ctx.detailUrl)}" style="${btnStyle}">View Appointment</a></p>
    `),
  };
}

export function appointmentReminder1hTemplate(ctx: BaseContext & {
  patientName: string;
  providerName: string;
  serviceName: string;
  appointmentTime: string;
  consultationType: string;
  joinUrl?: string;
  detailUrl: string;
}) {
  return {
    subject: `Starting Soon: ${ctx.serviceName} in 1 hour`,
    html: wrap(ctx, `
      <h2>Your Appointment Starts Soon</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Your ${esc(ctx.serviceName)} with ${esc(ctx.providerName)} starts in 1 hour at ${esc(ctx.appointmentTime)}.</p>
      ${ctx.consultationType === 'VIDEO' && ctx.joinUrl ? `<p><a href="${esc(ctx.joinUrl)}" style="${btnStyle}">Join Video Call</a></p>` : `<p><a href="${esc(ctx.detailUrl)}" style="${btnStyle}">View Details</a></p>`}
    `),
  };
}

export function appointmentFollowUpTemplate(ctx: BaseContext & {
  patientName: string;
  providerName: string;
  serviceName: string;
  rebookUrl: string;
}) {
  return {
    subject: `How was your ${ctx.serviceName} appointment?`,
    html: wrap(ctx, `
      <h2>Follow Up</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>We hope your ${esc(ctx.serviceName)} appointment with ${esc(ctx.providerName)} went well.</p>
      <p>If you need another appointment, you can book again anytime.</p>
      <p><a href="${esc(ctx.rebookUrl)}" style="${btnStyle}">Book Again</a></p>
    `),
  };
}

// ─── Intake Templates ───────────────────────────────────

export function intakeFormLinkTemplate(ctx: BaseContext & {
  patientName: string;
  serviceName: string;
  appointmentDate: string;
  intakeUrl: string;
}) {
  return {
    subject: `Please complete your intake form — ${ctx.serviceName}`,
    html: wrap(ctx, `
      <h2>Intake Form Required</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Please complete the intake form before your ${esc(ctx.serviceName)} appointment on ${esc(ctx.appointmentDate)}.</p>
      <p><a href="${esc(ctx.intakeUrl)}" style="${btnStyle}">Complete Form</a></p>
    `),
  };
}

export function intakeFormReminderTemplate(ctx: BaseContext & {
  patientName: string;
  serviceName: string;
  appointmentDate: string;
  intakeUrl: string;
}) {
  return {
    subject: `Reminder: Intake form needed — ${ctx.serviceName}`,
    html: wrap(ctx, `
      <h2>Intake Form Reminder</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Your ${esc(ctx.serviceName)} appointment is coming up on ${esc(ctx.appointmentDate)} and your intake form hasn't been completed yet.</p>
      <p><a href="${esc(ctx.intakeUrl)}" style="${btnStyle}">Complete Form Now</a></p>
    `),
  };
}

// ─── Payment Templates ──────────────────────────────────

export function paymentReceiptTemplate(ctx: BaseContext & {
  patientName: string;
  serviceName: string;
  amount: string;
  currency: string;
  paymentDate: string;
  receiptUrl?: string;
}) {
  return {
    subject: `Payment Receipt — ${ctx.amount}`,
    html: wrap(ctx, `
      <h2>Payment Receipt</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>We've received your payment:</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Service:</td><td>${esc(ctx.serviceName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Amount:</td><td>${esc(ctx.amount)} ${esc(ctx.currency)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${esc(ctx.paymentDate)}</td></tr>
      </table>
      ${ctx.receiptUrl ? `<p><a href="${esc(ctx.receiptUrl)}" style="${btnStyle}">View Receipt</a></p>` : ''}
    `),
  };
}

export function paymentRefundTemplate(ctx: BaseContext & {
  patientName: string;
  serviceName: string;
  refundAmount: string;
  currency: string;
}) {
  return {
    subject: `Refund Processed — ${ctx.refundAmount}`,
    html: wrap(ctx, `
      <h2>Refund Processed</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>A refund of ${esc(ctx.refundAmount)} ${esc(ctx.currency)} for ${esc(ctx.serviceName)} has been processed. It may take 5-10 business days to appear on your statement.</p>
    `),
  };
}

// ─── Provider Templates ─────────────────────────────────

export function providerInvitationTemplate(ctx: BaseContext & {
  inviteeName: string;
  inviterName: string;
  acceptUrl: string;
}) {
  return {
    subject: `You've been invited to join ${ctx.practiceName}`,
    html: wrap(ctx, `
      <h2>You're Invited!</h2>
      <p>Hi ${esc(ctx.inviteeName)},</p>
      <p>${esc(ctx.inviterName)} has invited you to join ${esc(ctx.practiceName)} as a provider on MedConnect.</p>
      <p><a href="${esc(ctx.acceptUrl)}" style="${btnStyle}">Accept Invitation</a></p>
      <p>This invitation expires in 7 days.</p>
    `),
  };
}

// ─── Messaging Templates ────────────────────────────────

export function unreadMessageTemplate(ctx: BaseContext & {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  inboxUrl: string;
}) {
  return {
    subject: `New message from ${ctx.senderName}`,
    html: wrap(ctx, `
      <h2>New Message</h2>
      <p>Hi ${esc(ctx.recipientName)},</p>
      <p><strong>${esc(ctx.senderName)}</strong> sent you a message:</p>
      <blockquote style="border-left:3px solid #0066cc;padding:8px 16px;margin:16px 0;color:#555;">${esc(ctx.messagePreview)}</blockquote>
      <p><a href="${esc(ctx.inboxUrl)}" style="${btnStyle}">View Message</a></p>
    `),
  };
}

// ─── Data Export Template ───────────────────────────────

export function dataExportReadyTemplate(ctx: BaseContext & {
  patientName: string;
  downloadUrl: string;
  expiresIn: string;
}) {
  return {
    subject: 'Your data export is ready',
    html: wrap(ctx, `
      <h2>Data Export Ready</h2>
      <p>Hi ${esc(ctx.patientName)},</p>
      <p>Your data export has been generated and is ready for download.</p>
      <p><a href="${esc(ctx.downloadUrl)}" style="${btnStyle}">Download Export</a></p>
      <p>This link expires in ${esc(ctx.expiresIn)}.</p>
    `),
  };
}

// ─── Helpers ────────────────────────────────────────────

const btnStyle =
  'display:inline-block;padding:12px 24px;background:#0066cc;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;';

function esc(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(ctx: BaseContext, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      ${ctx.practiceLogoUrl ? `<img src="${esc(ctx.practiceLogoUrl)}" alt="${esc(ctx.practiceName)}" style="max-height:48px;margin-bottom:16px;" />` : ''}
      ${body}
    </div>
    <div style="text-align:center;padding:16px;color:#999;font-size:12px;">
      <p>${esc(ctx.practiceName)} — Powered by MedConnect</p>
      <p style="font-style:italic;">This is a demo application. All patient data is synthetic.</p>
    </div>
  </div>
</body>
</html>`;
}
