import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '@medconnect/shared';

@Processor(QUEUES.SCHEDULING)
export class SchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'cleanExpiredReservations':
        await this.cleanExpiredReservations();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Runs every 1 minute. Deletes slot_reservations where expires_at < now().
   */
  private async cleanExpiredReservations(): Promise<void> {
    const result = await this.prisma.slotReservation.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned ${result.count} expired slot reservation(s)`);
    }
  }
}
