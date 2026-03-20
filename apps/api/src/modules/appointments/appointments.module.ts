import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentsController,
  SlotsController,
  PatientAppointmentsController,
} from './appointments.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [SlotsController, AppointmentsController, PatientAppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
