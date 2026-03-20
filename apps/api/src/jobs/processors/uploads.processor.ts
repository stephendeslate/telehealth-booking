import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@medconnect/shared';
import { UploadService } from '../../modules/uploads/upload.service';

@Processor(QUEUES.UPLOADS)
export class UploadsProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadsProcessor.name);

  constructor(private readonly uploadService: UploadService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'deleteOrphanedUpload': {
        const { key } = job.data;
        await this.uploadService.deleteOrphanedUpload(key);
        this.logger.log(`Orphaned upload deleted: ${key}`);
        break;
      }
      default:
        this.logger.warn(`Unknown uploads job: ${job.name}`);
    }
  }
}
