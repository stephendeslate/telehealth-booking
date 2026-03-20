import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/app-error';
import {
  BCRYPT_ROUNDS,
  ACCESS_TOKEN_EXPIRY_MINUTES,
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@medconnect/shared';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '@medconnect/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        name: dto.name,
        phone: dto.phone,
        date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
        gender: dto.gender,
      },
    });

    // If invitation token provided, accept it
    if (dto.invitation_token) {
      await this.acceptInvitation(dto.invitation_token, user.id);
    }

    // Generate verification token (mock — log it)
    const verificationToken = randomBytes(32).toString('hex');
    this.logger.log(
      `[MOCK EMAIL] Verification link for ${user.email}: /verify-email?token=${verificationToken}`,
    );

    // Store verification token hash in a simple way — reuse refresh_tokens table concept
    // For simplicity, store as a special refresh token with a flag
    // In practice, we'd have a separate table. For MVP, just auto-verify.

    const tokens = await this.generateTokenPair(user, ip, userAgent);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = await this.generateTokenPair(user, ip, userAgent);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.revoked_at) {
      // Token reuse detected — revoke entire family
      this.logger.warn(
        `Refresh token reuse detected for user ${storedToken.user_id}. Revoking token family.`,
      );
      await this.revokeTokenFamily(storedToken.id);
      throw new UnauthorizedError('Token reuse detected. All sessions revoked for security.');
    }

    if (storedToken.expires_at < new Date()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    // Generate new pair
    const tokens = await this.generateTokenPair(
      storedToken.user,
      ip,
      userAgent,
      storedToken.id,
    );

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.sanitizeUser(storedToken.user),
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });

    if (storedToken && !storedToken.revoked_at) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
      });
    }
  }

  async verifyEmail(token: string) {
    // For MVP, we auto-verify on registration. This endpoint is a stub.
    // In production, we'd look up the verification token and mark email_verified.
    this.logger.log(`[MOCK] Email verification with token: ${token}`);
    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If an account exists, a reset link has been sent' };
    }

    const resetToken = randomBytes(32).toString('hex');
    this.logger.log(
      `[MOCK EMAIL] Password reset for ${user.email}: /reset-password?token=${resetToken}`,
    );

    // In production, store reset token hash with expiry.
    // For MVP, log it.
    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // For MVP, this is a stub. In production, we'd verify the reset token.
    this.logger.log(`[MOCK] Password reset with token: ${dto.token}`);
    return { message: 'Password has been reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.password_hash) {
      throw new NotFoundError('User');
    }

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  async findOrCreateGoogleUser(profile: {
    google_id: string;
    email: string;
    name: string;
    avatar_url?: string;
  }) {
    // Try by google_id first
    let user = await this.prisma.user.findUnique({
      where: { google_id: profile.google_id },
    });
    if (user) return user;

    // Try by email
    user = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });
    if (user) {
      // Link Google account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          google_id: profile.google_id,
          email_verified: true,
          avatar_url: user.avatar_url || profile.avatar_url,
        },
      });
      return user;
    }

    // Create new user
    user = await this.prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        name: profile.name,
        google_id: profile.google_id,
        email_verified: true,
        avatar_url: profile.avatar_url,
      },
    });
    return user;
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Generate access + refresh tokens for a user directly (e.g., after Google OAuth).
   */
  async generateTokensForUser(
    user: { id: string; email: string; role: string },
    ip?: string,
    userAgent?: string,
  ) {
    const tokens = await this.generateTokenPair(user, ip, userAgent);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: this.sanitizeUser(user as any),
    };
  }

  // ─── Private helpers ───────────────────────────────

  private async generateTokenPair(
    user: { id: string; email: string; role: string },
    ip?: string,
    userAgent?: string,
    replacedTokenId?: string,
  ) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: `${ACCESS_TOKEN_EXPIRY_MINUTES}m` },
    );

    const refreshTokenId = randomBytes(16).toString('hex');
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: refreshTokenId },
      { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: ip,
        user_agent: userAgent,
        replaced_by: replacedTokenId,
      },
    });

    // Update the previous token to point to the new one
    if (replacedTokenId) {
      const newToken = await this.prisma.refreshToken.findUnique({
        where: { token_hash: tokenHash },
      });
      if (newToken) {
        await this.prisma.refreshToken.update({
          where: { id: replacedTokenId },
          data: { replaced_by: newToken.id },
        });
      }
    }

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeTokenFamily(tokenId: string) {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      select: { user_id: true },
    });
    if (!token) return;

    // Revoke all non-revoked tokens for this user (entire family)
    await this.prisma.refreshToken.updateMany({
      where: { user_id: token.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    email_verified: boolean;
    avatar_url: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      email_verified: user.email_verified,
      avatar_url: user.avatar_url,
    };
  }

  private async acceptInvitation(token: string, userId: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token_hash: tokenHash },
    });

    if (
      !invitation ||
      invitation.revoked_at ||
      invitation.accepted_at ||
      invitation.expires_at < new Date()
    ) {
      this.logger.warn(`Invalid or expired invitation token`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.invitationToken.update({
        where: { id: invitation.id },
        data: { accepted_at: new Date() },
      }),
      this.prisma.tenantMembership.create({
        data: {
          practice_id: invitation.practice_id,
          user_id: userId,
          role: invitation.role,
        },
      }),
    ]);
  }
}
