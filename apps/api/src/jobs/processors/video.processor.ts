import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';
import { VideoService } from '../../modules/video/video.service';

@Processor(QUEUES.VIDEO)
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(private readonly videoService: VideoService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'videoRoomCleanup': {
        const result = await this.videoService.cleanupRooms();
        this.logger.log(`Video room cleanup: ended ${result.ended} rooms`);
        break;
      }
      default:
        this.logger.warn(`Unknown video job: ${job.name}`);
    }
  }
}
