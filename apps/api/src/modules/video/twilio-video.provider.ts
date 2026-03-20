import { Injectable, Logger } from '@nestjs/common';
import type { VideoProvider, VideoProviderRoom, VideoProviderToken } from './video-provider.interface';

/**
 * Twilio Video provider implementation.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_API_KEY, and TWILIO_API_SECRET env vars.
 */
@Injectable()
export class TwilioVideoProvider implements VideoProvider {
  private readonly logger = new Logger(TwilioVideoProvider.name);
  private twilioClient: any;
  private apiKey: string;
  private apiSecret: string;
  private accountSid: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID!;
    this.apiKey = process.env.TWILIO_API_KEY!;
    this.apiSecret = process.env.TWILIO_API_SECRET!;
  }

  private async getClient() {
    if (!this.twilioClient) {
      const twilio = await import('twilio');
      this.twilioClient = twilio.default(this.accountSid, process.env.TWILIO_AUTH_TOKEN!);
    }
    return this.twilioClient;
  }

  async createRoom(name: string, maxParticipants: number): Promise<VideoProviderRoom> {
    const client = await this.getClient();

    const room = await client.video.v1.rooms.create({
      uniqueName: name,
      type: 'group',
      maxParticipants,
      statusCallback: `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/twilio`,
    });

    this.logger.log(`Created Twilio video room: ${name} (sid: ${room.sid})`);

    return {
      sid: room.sid,
      name: room.uniqueName,
      maxParticipants: room.maxParticipants,
    };
  }

  async endRoom(sid: string): Promise<void> {
    const client = await this.getClient();

    await client.video.v1.rooms(sid).update({ status: 'completed' });

    this.logger.log(`Ended Twilio video room: ${sid}`);
  }

  generateToken(roomName: string, userId: string, durationMinutes: number): VideoProviderToken {
    // Use synchronous require for AccessToken since it's a class export
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    const token = new AccessToken(
      this.accountSid,
      this.apiKey,
      this.apiSecret,
      {
        identity: userId,
        ttl: durationMinutes * 60,
      },
    );

    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    this.logger.log(`Generated Twilio token for user ${userId} in room ${roomName}`);

    return {
      token: token.toJwt(),
      roomName,
      expiresAt,
    };
  }
}
