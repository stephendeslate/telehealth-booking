/**
 * Sentry initialization for the NestJS API.
 * Only initializes when SENTRY_DSN env var is set.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/nestjs');

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.nestIntegration(),
      ],
    });

    console.log('Sentry initialized for API');
  } catch {
    console.warn('Sentry package not installed — error tracking disabled');
  }
}
