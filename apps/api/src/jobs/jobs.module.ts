import { Module } from '@nestjs/common';
import { QueueModule } from './queue.module';
import { EmailService } from './email.service';
import { RecurringJobsService } from './recurring-jobs.service';
import { AppointmentEventsHandler } from './appointment-events.handler';
import { SchedulingProcessor } from './processors/scheduling.processor';
import { AppointmentsProcessor } from './processors/appointments.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { VideoProcessor } from './processors/video.processor';
import { CalendarProcessor } from './processors/calendar.processor';
import { ExportsProcessor } from './processors/exports.processor';
import { UploadsProcessor } from './processors/uploads.processor';

@Module({
  imports: [QueueModule],
  providers: [
    EmailService,
    RecurringJobsService,
    AppointmentEventsHandler,
    // Processors
    SchedulingProcessor,
    AppointmentsProcessor,
    NotificationsProcessor,
    VideoProcessor,
    CalendarProcessor,
    ExportsProcessor,
    UploadsProcessor,
  ],
  exports: [EmailService],
})
export class JobsModule {}
