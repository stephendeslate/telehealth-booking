import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { VideoProvider, VideoProviderRoom, VideoProviderToken } from './video-provider.interface';

@Injectable()
export class MockVideoProvider implements VideoProvider {
  private readonly logger = new Logger(MockVideoProvider.name);

  async createRoom(name: string, maxParticipants: number): Promise<VideoProviderRoom> {
    const sid = `RM${randomBytes(16).toString('hex')}`;
    this.logger.log(`[MOCK] Created video room: ${name} (sid: ${sid})`);
    return { sid, name, maxParticipants };
  }

  async endRoom(sid: string): Promise<void> {
    this.logger.log(`[MOCK] Ended video room: ${sid}`);
  }

  generateToken(roomName: string, userId: string, durationMinutes: number): VideoProviderToken {
    const token = `mock_token_${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    this.logger.log(`[MOCK] Generated token for user ${userId} in room ${roomName}`);
    return { token, roomName, expiresAt };
  }
}
