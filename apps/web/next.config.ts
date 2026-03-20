import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@medconnect/shared', '@medconnect/ui'],
};

export default nextConfig;
