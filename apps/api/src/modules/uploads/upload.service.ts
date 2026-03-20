import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  QUEUES,
  UPLOAD_LIMITS,
  UPLOAD_MIME_TYPES,
  ORPHANED_UPLOAD_CLEANUP_DELAY_HOURS,
  DATA_EXPORT_RATE_LIMIT_HOURS,
  AuditAction,
  JOB_DEFAULTS,
  UploadPurpose,
} from '@medconnect/shared';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: any = null;
  private bucketName: string;
  private publicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.UPLOADS) private readonly uploadsQueue: Queue,
    @InjectQueue(QUEUES.EXPORTS) private readonly exportsQueue: Queue,
  ) {
    this.bucketName = this.config.get<string>('R2_BUCKET_NAME', 'medconnect-uploads');
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL', 'https://mock-r2.example.com/public');
  }

  async onModuleInit() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    if (accountId && accessKeyId && secretAccessKey) {
      try {
        const { S3Client } = await import('@aws-sdk/client-s3');
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        });
        this.logger.log('Cloudflare R2 storage initialized');
      } catch (err) {
        this.logger.warn('AWS S3 SDK not installed — falling back to mock uploads');
      }
    } else {
      this.logger.log('R2 credentials not set — using mock upload service');
    }
  }

  /**
   * Generate a presigned upload URL (mock R2).
   */
  async presignUpload(opts: {
    purpose: UploadPurpose;
    filename: string;
    contentType: string;
    contentLength: number;
    userId: string;
  }) {
    const { purpose, filename, contentType, contentLength, userId } = opts;

    // Validate size
    const maxSize = UPLOAD_LIMITS[purpose];
    if (maxSize && contentLength > maxSize) {
      throw new Error(
        `File too large for ${purpose}. Max: ${maxSize} bytes, got: ${contentLength} bytes`,
      );
    }

    // Validate MIME type
    const allowedTypes = UPLOAD_MIME_TYPES[purpose] as readonly string[];
    if (allowedTypes && !allowedTypes.includes(contentType)) {
      throw new Error(
        `Invalid content type for ${purpose}. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    const key = `${purpose}/${userId}/${randomBytes(16).toString('hex')}/${filename}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    let uploadUrl: string;
    let publicUrl: string;

    if (this.s3Client) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      publicUrl = `${this.publicUrl}/${key}`;
      this.logger.log(`R2 presigned upload URL generated for ${key}`);
    } else {
      uploadUrl = `https://mock-r2.example.com/upload/${key}?X-Amz-Expires=3600`;
      publicUrl = `https://mock-r2.example.com/public/${key}`;
      this.logger.log(`[MOCK] Presigned upload URL generated for ${key}`);
    }

    // Schedule orphaned upload cleanup
    await this.uploadsQueue.add(
      'deleteOrphanedUpload',
      { key, userId },
      {
        ...JOB_DEFAULTS,
        delay: ORPHANED_UPLOAD_CLEANUP_DELAY_HOURS * 3600 * 1000,
      },
    );

    return {
      upload_url: uploadUrl,
      public_url: publicUrl,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Delete an orphaned upload from R2 (or mock).
   */
  async deleteOrphanedUpload(key: string): Promise<void> {
    if (this.s3Client) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      this.logger.log(`R2 deleted orphaned upload: ${key}`);
    } else {
      this.logger.log(`[MOCK] Deleted orphaned upload: ${key}`);
    }
  }

  /**
   * Request a patient data export.
   * Rate limited to 1 per 24 hours per user.
   */
  async requestDataExport(userId: string) {
    // Check rate limit
    const recentExport = await this.prisma.auditLog.findFirst({
      where: {
        user_id: userId,
        action: AuditAction.PATIENT_DATA_EXPORT,
        created_at: {
          gte: new Date(Date.now() - DATA_EXPORT_RATE_LIMIT_HOURS * 3600 * 1000),
        },
      },
    });

    if (recentExport) {
      throw new Error(
        `Data export rate limited. Try again after ${DATA_EXPORT_RATE_LIMIT_HOURS} hours from last export.`,
      );
    }

    // Queue the export job
    await this.exportsQueue.add(
      'generatePatientDataExport',
      { userId },
      { ...JOB_DEFAULTS },
    );

    await this.audit.log({
      user_id: userId,
      action: AuditAction.PATIENT_DATA_EXPORT,
      resource_type: 'user',
      resource_id: userId,
    });

    this.logger.log(`[MOCK] Data export queued for user ${userId}`);

    return { status: 'queued', message: 'Your data export has been queued.' };
  }

  /**
   * Generate patient data export (called by job processor).
   */
  async generateDataExport(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        appointments: {
          include: {
            service: { select: { name: true } },
            practice: { select: { name: true } },
            intake_submission: true,
          },
        },
        sent_messages: true,
        consent_records: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
        created_at: user.created_at,
      },
      appointments: user.appointments,
      messages: user.sent_messages,
      consent_records: user.consent_records,
      exported_at: new Date().toISOString(),
    };

    const key = `exports/${userId}/${Date.now()}.json`;
    const body = JSON.stringify(exportData);

    if (this.s3Client) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      }));
      this.logger.log(`Data export uploaded to R2: ${key} (${body.length} bytes)`);
    } else {
      this.logger.log(
        `[MOCK] Data export uploaded to R2: ${key} (${body.length} bytes)`,
      );
    }

    return key;
  }
}
