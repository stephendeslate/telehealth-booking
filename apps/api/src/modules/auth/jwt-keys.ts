import { generateKeyPairSync } from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('JwtKeys');

let cachedKeyPair: { privateKey: string; publicKey: string } | null = null;

/**
 * Get JWT RS256 key pair from env vars or auto-generate for development.
 */
export function getJwtKeyPair(): { privateKey: string; publicKey: string } {
  if (cachedKeyPair) return cachedKeyPair;

  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (privateKey && publicKey) {
    cachedKeyPair = {
      privateKey: privateKey.replace(/\\n/g, '\n'),
      publicKey: publicKey.replace(/\\n/g, '\n'),
    };
    return cachedKeyPair;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production');
  }

  logger.warn('No JWT keys configured — generating ephemeral RS256 key pair for development');
  const generated = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  cachedKeyPair = {
    privateKey: generated.privateKey as string,
    publicKey: generated.publicKey as string,
  };
  return cachedKeyPair;
}
