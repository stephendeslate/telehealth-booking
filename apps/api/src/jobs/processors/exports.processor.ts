import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';

/**
 * Exports queue processor. Stub for Phase 5 — real implementation in Phase 7.
 */
@Processor(QUEUES.EXPORTS)
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'generatePatientDataExport':
        this.logger.log(
          `[STUB] generatePatientDataExport for user ${job.data?.userId} — mock R2 upload`,
        );
        break;
      default:
        this.logger.warn(`Unknown exports job: ${job.name}`);
    }
  }
}
