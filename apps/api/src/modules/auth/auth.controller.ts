import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '@medconnect/shared';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type RegisterDto,
  type LoginDto,
  type VerifyEmailDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type ChangePasswordDto,
} from '@medconnect/shared';

@ApiTags('auth')
@ApiBearerAuth('JWT')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @Throttle({ default: { limit: RATE_LIMITS.auth.limit, ttl: RATE_LIMITS.auth.ttl * 1000 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: RATE_LIMITS.auth.limit, ttl: RATE_LIMITS.auth.ttl * 1000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: { refresh_token?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Accept refresh token from cookie or body
    const refreshToken =
      body.refresh_token || req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: 'Refresh token required',
      });
    }

    const result = await this.authService.refresh(
      refreshToken,
      req.ip,
      req.headers['user-agent'],
    );

    this.setRefreshTokenCookie(res, result.refresh_token);

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Log out and invalidate refresh token' })
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.body?.refresh_token || req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address with token' })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto,
  ) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: RATE_LIMITS.password_reset.limit, ttl: RATE_LIMITS.password_reset.ttl * 1000 } })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser('sub') userId: string) {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      return { user: null };
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified: user.email_verified,
        avatar_url: user.avatar_url,
      },
    };
  }

  // ─── Google OAuth Stub ──────────────────────────────

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleAuth(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Mock mode: redirect to callback with mock data
      return res.redirect('/api/auth/google/callback?mock=true');
    }
    const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile&access_type=offline`;
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isMock = req.query.mock === 'true';

    let profile: { google_id: string; email: string; name: string; avatar_url?: string };

    if (isMock || !process.env.GOOGLE_CLIENT_ID) {
      // Mock Google OAuth
      profile = {
        google_id: 'mock-google-id-12345',
        email: 'demo@medconnect.local',
        name: 'Demo User (Google)',
        avatar_url: undefined,
      };
    } else {
      // Real Google OAuth: exchange code for tokens, then fetch user profile
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).json({ message: 'Missing authorization code' });
      }

      const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        return res.status(401).json({ message: 'Google OAuth token exchange failed' });
      }

      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo: any = await userInfoRes.json();

      profile = {
        google_id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar_url: userInfo.picture,
      };
    }

    const user = await this.authService.findOrCreateGoogleUser(profile);
    const tokens = await this.authService.generateTokensForUser(
      user,
      req.ip,
      req.headers['user-agent'],
    );

    this.setRefreshTokenCookie(res, tokens.refresh_token);
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return res.redirect(`${webUrl}/auth/google-success?token=${tokens.access_token}`);
  }

  // ─── Helpers ────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });
  }
}
