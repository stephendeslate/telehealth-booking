import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../../common/errors/app-error';
import {
  AuditAction,
  CalendarProvider,
  QUEUES,
  JOB_DEFAULTS,
} from '@medconnect/shared';

/**
 * Calendar sync service with Google Calendar integration.
 * Uses real Google Calendar API when GOOGLE_CALENDAR_CLIENT_ID is set,
 * otherwise falls back to mock. Tokens encrypted via AES-256-GCM.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly useRealCalendar: boolean;
  private readonly encryptionKey: Buffer | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.CALENDAR) private readonly calendarQueue: Queue,
  ) {
    this.useRealCalendar = !!(
      this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID') &&
      this.config.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET')
    );

    const keyHex = this.config.get<string>('CALENDAR_TOKEN_ENCRYPTION_KEY');
    this.encryptionKey = keyHex ? Buffer.from(keyHex, 'hex') : null;

    if (this.useRealCalendar) {
      this.logger.log('Google Calendar integration enabled');
    } else {
      this.logger.log('Google Calendar not configured — using mock calendar');
    }
  }

  private encryptToken(plaintext: string): string {
    if (!this.encryptionKey) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptToken(ciphertext: string): string {
    if (!this.encryptionKey) return ciphertext;
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext; // Not encrypted (legacy mock token)
    const [ivHex, authTagHex, encryptedHex] = parts;
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(Buffer.from(encryptedHex, 'hex')) + decipher.final('utf8');
  }

  /**
   * Connect a calendar (mock — stores connection record).
   */
  async connect(opts: {
    providerProfileId: string;
    provider: CalendarProvider;
    authCode: string;
    redirectUri: string;
    userId: string;
  }) {
    const providerProfile = await this.prisma.providerProfile.findUnique({
      where: { id: opts.providerProfileId },
    });
    if (!providerProfile) {
      throw new NotFoundError('ProviderProfile', opts.providerProfileId);
    }

    let accessToken: string;
    let refreshToken: string;
    let calendarId: string;
    let tokenExpiresAt: Date;

    if (this.useRealCalendar && opts.provider === CalendarProvider.GOOGLE) {
      // Exchange auth code for tokens via Google OAuth
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: opts.authCode,
          client_id: this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID'),
          client_secret: this.config.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET'),
          redirect_uri: opts.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error('Google Calendar OAuth token exchange failed');
      }

      accessToken = this.encryptToken(tokenData.access_token);
      refreshToken = this.encryptToken(tokenData.refresh_token || '');
      tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      // Fetch primary calendar ID
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const calData = await calRes.json();
      calendarId = calData.id || 'primary';
    } else {
      // Mock mode
      accessToken = 'mock_access_token';
      refreshToken = 'mock_refresh_token';
      calendarId = `mock_cal_${opts.provider.toLowerCase()}`;
      tokenExpiresAt = new Date(Date.now() + 3600 * 1000);
    }

    const connection = await this.prisma.calendarConnection.create({
      data: {
        practice_id: providerProfile.practice_id,
        provider_profile_id: opts.providerProfileId,
        provider: opts.provider,
        status: 'ACTIVE',
        calendar_id: calendarId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
      },
    });

    await this.audit.log({
      user_id: opts.userId,
      practice_id: providerProfile.practice_id,
      action: AuditAction.CALENDAR_CONNECTED,
      resource_type: 'calendar_connection',
      resource_id: connection.id,
      metadata: { provider: opts.provider } as any,
    });

    this.logger.log(
      `[MOCK] Calendar connected: ${opts.provider} for provider ${opts.providerProfileId}`,
    );

    return this.formatConnection(connection);
  }

  /**
   * Disconnect a calendar connection.
   */
  async disconnect(connectionId: string, userId: string) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { id: connectionId },
      include: { provider_profile: true },
    });

    if (!connection) throw new NotFoundError('CalendarConnection', connectionId);

    const updated = await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED' },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: connection.provider_profile.practice_id,
      action: AuditAction.CALENDAR_DISCONNECTED,
      resource_type: 'calendar_connection',
      resource_id: connection.id,
    });

    this.logger.log(`[MOCK] Calendar disconnected: ${connection.id}`);

    return this.formatConnection(updated);
  }

  /**
   * Get calendar connection status for a provider.
   */
  async getStatus(providerProfileId: string) {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { provider_profile_id: providerProfileId },
      orderBy: { created_at: 'desc' },
    });

    return connections.map((c) => this.formatConnection(c));
  }

  /**
   * Push an appointment event to the connected calendar.
   */
  async pushEvent(appointmentId: string) {
    await this.calendarQueue.add(
      'calendarEventPush',
      { appointmentId },
      { ...JOB_DEFAULTS },
    );

    this.logger.log(`[MOCK] Queued calendar push for appointment ${appointmentId}`);
  }

  /**
   * Inbound sync — pull external events (mock).
   */
  async inboundSync(): Promise<{ synced: number }> {
    const activeConnections = await this.prisma.calendarConnection.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const conn of activeConnections) {
      await this.prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { last_synced_at: new Date() },
      });
    }

    this.logger.log(`[MOCK] Inbound sync: ${activeConnections.length} connections`);
    return { synced: activeConnections.length };
  }

  /**
   * Refresh expired calendar tokens.
   * Uses real Google OAuth refresh when configured, otherwise mocks.
   */
  async refreshTokens(): Promise<{ refreshed: number }> {
    const expiredConnections = await this.prisma.calendarConnection.findMany({
      where: {
        status: 'ACTIVE',
        token_expires_at: { lte: new Date() },
      },
    });

    let refreshed = 0;

    for (const conn of expiredConnections) {
      if (this.useRealCalendar && conn.provider === CalendarProvider.GOOGLE && conn.refresh_token) {
        try {
          const decryptedRefreshToken = this.decryptToken(conn.refresh_token);
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID'),
              client_secret: this.config.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET'),
              refresh_token: decryptedRefreshToken,
              grant_type: 'refresh_token',
            }),
          });
          const tokenData = await tokenRes.json();

          if (tokenRes.ok && tokenData.access_token) {
            await this.prisma.calendarConnection.update({
              where: { id: conn.id },
              data: {
                access_token: this.encryptToken(tokenData.access_token),
                token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
              },
            });
            refreshed++;
          } else {
            this.logger.warn(`Failed to refresh token for connection ${conn.id}`);
            await this.prisma.calendarConnection.update({
              where: { id: conn.id },
              data: { status: 'ERROR' },
            });
          }
        } catch (err: any) {
          this.logger.error(`Token refresh error for ${conn.id}: ${err.message}`);
        }
      } else {
        // Mock refresh
        await this.prisma.calendarConnection.update({
          where: { id: conn.id },
          data: {
            token_expires_at: new Date(Date.now() + 3600 * 1000),
          },
        });
        refreshed++;
      }
    }

    this.logger.log(`Token refresh: ${refreshed}/${expiredConnections.length} connections`);
    return { refreshed };
  }

  private formatConnection(connection: any) {
    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      calendar_id: connection.calendar_id,
      last_synced_at: connection.last_synced_at,
      created_at: connection.created_at,
    };
  }
}
