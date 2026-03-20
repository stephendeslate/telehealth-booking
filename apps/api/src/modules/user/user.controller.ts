import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('users')
@ApiBearerAuth('JWT')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
        email_verified: true,
        date_of_birth: true,
        gender: true,
        locale: true,
        timezone: true,
        notification_preferences: true,
        created_at: true,
      },
    });
    return profile;
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name?: string;
      phone?: string;
      avatar_url?: string | null;
      date_of_birth?: string;
      gender?: string;
      locale?: string;
      timezone?: string;
      notification_preferences?: { email: boolean; sms: boolean; push: boolean };
    },
  ) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.avatar_url !== undefined) data.avatar_url = body.avatar_url;
    if (body.date_of_birth !== undefined)
      data.date_of_birth = new Date(body.date_of_birth);
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.locale !== undefined) data.locale = body.locale;
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.notification_preferences !== undefined)
      data.notification_preferences = body.notification_preferences;

    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
        email_verified: true,
        date_of_birth: true,
        gender: true,
        locale: true,
        timezone: true,
        notification_preferences: true,
        created_at: true,
      },
    });

    return updated;
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get payment history' })
  async getPaymentHistory(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    const where = {
      appointment: { patient_id: user.sub },
    };

    const [payments, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          appointment: {
            select: {
              id: true,
              start_time: true,
              service: { select: { name: true } },
              practice: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        platform_fee: p.platform_fee ? Number(p.platform_fee) : null,
        refund_amount: p.refund_amount ? Number(p.refund_amount) : null,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }
}
