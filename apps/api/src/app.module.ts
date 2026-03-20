import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { PracticesModule } from './modules/practices/practices.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { IntakeModule } from './modules/intake/intake.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { VideoModule } from './modules/video/video.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthController } from './health.controller';
import { RATE_LIMITS } from '@medconnect/shared';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: RATE_LIMITS.api.ttl * 1000,
        limit: RATE_LIMITS.api.limit,
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    PracticesModule,
    ProvidersModule,
    ServicesModule,
    AppointmentsModule,
    IntakeModule,
    NotificationsModule,
    MessagingModule,
    VideoModule,
    PaymentsModule,
    CalendarModule,
    UserModule,
    AdminModule,
    UploadsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
