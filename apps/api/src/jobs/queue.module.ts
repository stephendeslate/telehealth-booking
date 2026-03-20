import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES, JOB_DEFAULTS } from '@medconnect/shared';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: JOB_DEFAULTS.attempts,
          backoff: JOB_DEFAULTS.backoff,
          removeOnComplete: JOB_DEFAULTS.removeOnComplete,
          removeOnFail: JOB_DEFAULTS.removeOnFail,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.SCHEDULING },
      { name: QUEUES.APPOINTMENTS },
      { name: QUEUES.NOTIFICATIONS },
      { name: QUEUES.VIDEO },
      { name: QUEUES.CALENDAR },
      { name: QUEUES.EXPORTS },
      { name: QUEUES.UPLOADS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
