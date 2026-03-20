import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@medconnect/shared', '@medconnect/ui'],
};

let config: NextConfig = nextConfig;

// Wrap with Sentry only when SENTRY_DSN is configured and package is installed
if (process.env.SENTRY_DSN) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs');
    config = withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch {
    // @sentry/nextjs not installed — skip Sentry wrapping
  }
}

export default config;
