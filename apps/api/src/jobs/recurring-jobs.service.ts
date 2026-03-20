import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '@medconnect/shared';

/**
 * Registers all repeatable (cron-like) jobs on module init.
 */
@Injectable()
export class RecurringJobsService implements OnModuleInit {
  private readonly logger = new Logger(RecurringJobsService.name);

  constructor(
    @InjectQueue(QUEUES.SCHEDULING) private readonly schedulingQueue: Queue,
    @InjectQueue(QUEUES.APPOINTMENTS) private readonly appointmentsQueue: Queue,
    @InjectQueue(QUEUES.VIDEO) private readonly videoQueue: Queue,
    @InjectQueue(QUEUES.CALENDAR) private readonly calendarQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerRepeatableJobs();
    this.logger.log('All recurring jobs registered');
  }

  private async registerRepeatableJobs(): Promise<void> {
    // Clean expired slot reservations — every 1 minute
    await this.schedulingQueue.add(
      'cleanExpiredReservations',
      {},
      {
        repeat: { every: 60_000 },
        jobId: 'recurring-cleanExpiredReservations',
      },
    );

    // Auto-complete past IN_PERSON/PHONE appointments — every 5 minutes
    await this.appointmentsQueue.add(
      'processCompletedAppointments',
      {},
      {
        repeat: { every: 300_000 },
        jobId: 'recurring-processCompletedAppointments',
      },
    );

    // Detect no-shows for VIDEO appointments — every 5 minutes
    await this.appointmentsQueue.add(
      'detectNoShows',
      {},
      {
        repeat: { every: 300_000 },
        jobId: 'recurring-detectNoShows',
      },
    );

    // Enforce manual approval deadlines — every 1 hour
    await this.appointmentsQueue.add(
      'enforceApprovalDeadlines',
      {},
      {
        repeat: { every: 3_600_000 },
        jobId: 'recurring-enforceApprovalDeadlines',
      },
    );

    // Video room cleanup — every 5 minutes (stub)
    await this.videoQueue.add(
      'videoRoomCleanup',
      {},
      {
        repeat: { every: 300_000 },
        jobId: 'recurring-videoRoomCleanup',
      },
    );

    // Calendar inbound sync — every 15 minutes (stub)
    await this.calendarQueue.add(
      'calendarInboundSync',
      {},
      {
        repeat: { every: 900_000 },
        jobId: 'recurring-calendarInboundSync',
      },
    );

    // Calendar token refresh — every 1 hour (stub)
    await this.calendarQueue.add(
      'calendarTokenRefresh',
      {},
      {
        repeat: { every: 3_600_000 },
        jobId: 'recurring-calendarTokenRefresh',
      },
    );
  }
}
