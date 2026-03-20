/**
 * Abstraction layer for video providers (Twilio, mock, etc.)
 */
export interface VideoProviderRoom {
  sid: string;
  name: string;
  maxParticipants: number;
}

export interface VideoProviderToken {
  token: string;
  roomName: string;
  expiresAt: Date;
}

export interface VideoProvider {
  createRoom(name: string, maxParticipants: number): Promise<VideoProviderRoom>;
  endRoom(sid: string): Promise<void>;
  generateToken(roomName: string, userId: string, durationMinutes: number): VideoProviderToken;
}

export const VIDEO_PROVIDER = 'VIDEO_PROVIDER';
