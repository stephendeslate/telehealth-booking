import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';

/**
 * Video queue processor. Stub for Phase 5 — real implementation in Phase 7.
 */
@Processor(QUEUES.VIDEO)
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'videoRoomCleanup':
        this.logger.log('[STUB] videoRoomCleanup — no video rooms to clean');
        break;
      default:
        this.logger.warn(`Unknown video job: ${job.name}`);
    }
  }
}
