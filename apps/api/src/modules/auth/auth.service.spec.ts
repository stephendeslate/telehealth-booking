import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getJwtKeyPair } from './jwt-keys';
import {
  createTestUser,
  DEFAULT_PASSWORD,
  resetFactoryCounter,
} from '../../../test/factories';
import { ConflictError, UnauthorizedError } from '../../common/errors/app-error';

let module: TestingModule;
let authService: AuthService;
let prisma: PrismaService;

beforeAll(async () => {
  const keys = getJwtKeyPair();

  module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        signOptions: { algorithm: 'RS256', issuer: 'medconnect' },
        verifyOptions: { algorithms: ['RS256'], issuer: 'medconnect' },
      }),
    ],
    providers: [AuthService, PrismaService],
  }).compile();

  authService = module.get(AuthService);
  prisma = module.get(PrismaService);
  await prisma.$connect();
}, 30000);

beforeEach(async () => {
  resetFactoryCounter();
  await prisma.$executeRawUnsafe(`
    TRUNCATE refresh_tokens, consent_records, notifications, audit_logs,
             tenant_memberships, invitation_tokens, provider_profiles, users
    CASCADE
  `);
});

afterAll(async () => {
  if (prisma) {
    await prisma.$executeRawUnsafe(`
      TRUNCATE refresh_tokens, consent_records, notifications, audit_logs,
               tenant_memberships, invitation_tokens, provider_profiles, users
      CASCADE
    `);
    await prisma.$disconnect();
  }
  if (module) {
    await module.close();
  }
});

describe('register', () => {
  it('should create a new user and return tokens', async () => {
    const result = await authService.register({
      email: 'new@medconnect.test',
      password: 'SecurePass123!',
      name: 'New User',
      terms_accepted: true,
      privacy_accepted: true,
    });

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.user.email).toBe('new@medconnect.test');
    expect(result.user.name).toBe('New User');
    expect(result.user.role).toBe('USER');
  });

  it('should reject duplicate email', async () => {
    await createTestUser(prisma, { email: 'dupe@medconnect.test' });

    await expect(
      authService.register({
        email: 'dupe@medconnect.test',
        password: 'SecurePass123!',
        name: 'Dupe User',
        terms_accepted: true,
        privacy_accepted: true,
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('login', () => {
  it('should return tokens for valid credentials', async () => {
    await createTestUser(prisma, { email: 'login@medconnect.test' });

    const result = await authService.login({
      email: 'login@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.user.email).toBe('login@medconnect.test');
  });

  it('should reject invalid password', async () => {
    await createTestUser(prisma, { email: 'bad@medconnect.test' });

    await expect(
      authService.login({
        email: 'bad@medconnect.test',
        password: 'WrongPassword!',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should reject non-existent email', async () => {
    await expect(
      authService.login({
        email: 'noexist@medconnect.test',
        password: DEFAULT_PASSWORD,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('refresh', () => {
  it('should rotate refresh tokens', async () => {
    await createTestUser(prisma, { email: 'refresh@medconnect.test' });
    const loginResult = await authService.login({
      email: 'refresh@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    const refreshResult = await authService.refresh(loginResult.refresh_token);

    expect(refreshResult.access_token).toBeDefined();
    expect(refreshResult.refresh_token).toBeDefined();
    expect(refreshResult.refresh_token).not.toBe(loginResult.refresh_token);
  });

  it('should revoke family on token reuse', async () => {
    await createTestUser(prisma, { email: 'reuse@medconnect.test' });
    const loginResult = await authService.login({
      email: 'reuse@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    // Use the refresh token once (valid)
    await authService.refresh(loginResult.refresh_token);

    // Try to reuse the same token (should trigger family revocation)
    await expect(
      authService.refresh(loginResult.refresh_token),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('logout', () => {
  it('should revoke the refresh token', async () => {
    await createTestUser(prisma, { email: 'logout@medconnect.test' });
    const loginResult = await authService.login({
      email: 'logout@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    await authService.logout(loginResult.refresh_token);

    // Trying to refresh with revoked token should fail
    await expect(
      authService.refresh(loginResult.refresh_token),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('changePassword', () => {
  it('should change password and revoke all tokens', async () => {
    const user = await createTestUser(prisma, { email: 'change@medconnect.test' });
    const loginResult = await authService.login({
      email: 'change@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    await authService.changePassword(user.id, {
      current_password: DEFAULT_PASSWORD,
      new_password: 'NewSecurePass456!',
    });

    // Old refresh token should be revoked
    await expect(
      authService.refresh(loginResult.refresh_token),
    ).rejects.toThrow(UnauthorizedError);

    // Should be able to login with new password
    const newLogin = await authService.login({
      email: 'change@medconnect.test',
      password: 'NewSecurePass456!',
    });
    expect(newLogin.access_token).toBeDefined();
  });

  it('should reject wrong current password', async () => {
    const user = await createTestUser(prisma, { email: 'wrongpw@medconnect.test' });

    await expect(
      authService.changePassword(user.id, {
        current_password: 'WrongPassword!',
        new_password: 'NewPassword123!',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('JWT RS256', () => {
  it('should produce valid JWT tokens verifiable with public key', async () => {
    await createTestUser(prisma, { email: 'jwt@medconnect.test' });
    const result = await authService.login({
      email: 'jwt@medconnect.test',
      password: DEFAULT_PASSWORD,
    });

    const jwtService = module.get(JwtService);
    const payload = jwtService.verify(result.access_token);

    expect(payload.sub).toBeDefined();
    expect(payload.email).toBe('jwt@medconnect.test');
    expect(payload.role).toBe('USER');
    expect(payload.iss).toBe('medconnect');
  });
});

describe('findOrCreateGoogleUser', () => {
  it('should create a new user for new Google account', async () => {
    const user = await authService.findOrCreateGoogleUser({
      google_id: 'google-123',
      email: 'google@medconnect.test',
      name: 'Google User',
    });

    expect(user.email).toBe('google@medconnect.test');
    expect(user.google_id).toBe('google-123');
    expect(user.email_verified).toBe(true);
  });

  it('should link Google to existing email user', async () => {
    await createTestUser(prisma, { email: 'existing@medconnect.test' });

    const user = await authService.findOrCreateGoogleUser({
      google_id: 'google-456',
      email: 'existing@medconnect.test',
      name: 'Existing User',
    });

    expect(user.google_id).toBe('google-456');
    expect(user.email_verified).toBe(true);
  });

  it('should return existing user for known google_id', async () => {
    const created = await authService.findOrCreateGoogleUser({
      google_id: 'google-789',
      email: 'first@medconnect.test',
      name: 'First',
    });

    const found = await authService.findOrCreateGoogleUser({
      google_id: 'google-789',
      email: 'different@medconnect.test',
      name: 'Second',
    });

    expect(found.id).toBe(created.id);
  });
});
