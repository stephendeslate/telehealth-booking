import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';
import { CalendarService } from '../../modules/calendar/calendar.service';

@Processor(QUEUES.CALENDAR)
export class CalendarProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarProcessor.name);

  constructor(private readonly calendarService: CalendarService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'calendarInboundSync': {
        const result = await this.calendarService.inboundSync();
        this.logger.log(`Calendar inbound sync: ${result.synced} connections synced`);
        break;
      }
      case 'calendarTokenRefresh': {
        const result = await this.calendarService.refreshTokens();
        this.logger.log(`Calendar token refresh: ${result.refreshed} tokens refreshed`);
        break;
      }
      case 'calendarEventPush': {
        const { appointmentId } = job.data;
        this.logger.log(`[MOCK] Calendar event pushed for appointment ${appointmentId}`);
        break;
      }
      default:
        this.logger.warn(`Unknown calendar job: ${job.name}`);
    }
  }
}
