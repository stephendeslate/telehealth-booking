import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';

/**
 * Calendar queue processor. Stub for Phase 5 — real implementation in Phase 7.
 */
@Processor(QUEUES.CALENDAR)
export class CalendarProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'calendarInboundSync':
        this.logger.log('[STUB] calendarInboundSync — no calendar connections');
        break;
      case 'calendarTokenRefresh':
        this.logger.log('[STUB] calendarTokenRefresh — no tokens to refresh');
        break;
      case 'calendarEventPush':
        this.logger.log('[STUB] calendarEventPush — no calendar to push to');
        break;
      default:
        this.logger.warn(`Unknown calendar job: ${job.name}`);
    }
  }
}
