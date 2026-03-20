import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('uploads')
@ApiBearerAuth('JWT')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Get presigned upload URL' })
  async presign(
    @Body() body: { purpose: string; filename: string; content_type: string; content_length: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.uploadService.presignUpload({
      purpose: body.purpose as any,
      filename: body.filename,
      contentType: body.content_type,
      contentLength: body.content_length,
      userId: user.sub,
    });
  }

  @Post('export')
  @ApiOperation({ summary: 'Request patient data export' })
  async requestExport(@CurrentUser() user: JwtPayload) {
    return this.uploadService.requestDataExport(user.sub);
  }
}
