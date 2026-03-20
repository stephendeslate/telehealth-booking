import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';
import { UploadService } from '../../modules/uploads/upload.service';

@Processor(QUEUES.EXPORTS)
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(private readonly uploadService: UploadService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'generatePatientDataExport': {
        const { userId } = job.data;
        const key = await this.uploadService.generateDataExport(userId);
        this.logger.log(`Data export completed for user ${userId}: ${key}`);
        break;
      }
      default:
        this.logger.warn(`Unknown exports job: ${job.name}`);
    }
  }
}
