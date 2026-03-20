import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';

/**
 * Uploads queue processor. Stub for Phase 5 — real implementation in Phase 7.
 */
@Processor(QUEUES.UPLOADS)
export class UploadsProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadsProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'deleteOrphanedUpload':
        this.logger.log(
          `[STUB] deleteOrphanedUpload — mock R2 deletion for ${job.data?.key}`,
        );
        break;
      default:
        this.logger.warn(`Unknown uploads job: ${job.name}`);
    }
  }
}
