import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController, TwilioWebhookController } from './video.controller';
import { MockVideoProvider } from './mock-video.provider';
import { TwilioVideoProvider } from './twilio-video.provider';
import { VIDEO_PROVIDER } from './video-provider.interface';

const useTwilio = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_API_KEY &&
  process.env.TWILIO_API_SECRET
);

@Module({
  controllers: [VideoController, TwilioWebhookController],
  providers: [
    VideoService,
    {
      provide: VIDEO_PROVIDER,
      useClass: useTwilio ? TwilioVideoProvider : MockVideoProvider,
    },
  ],
  exports: [VideoService],
})
export class VideoModule {}
