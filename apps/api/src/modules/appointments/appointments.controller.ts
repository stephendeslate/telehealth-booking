import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { ParticipantGuard } from '../../common/guards/participant.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  reserveSlotSchema,
  createAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  appointmentNotesSchema,
  appointmentListQuerySchema,
  MembershipRole,
} from '@medconnect/shared';
import type {
  ReserveSlotDto,
  CreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  AppointmentNotesDto,
} from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';
import type { Request } from 'express';

// ─── Slot Reservation (public — guests can reserve) ──────────────

@ApiTags('appointments')
@Controller('practices/:practiceId/slots')
export class SlotsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post('reserve')
  @ApiOperation({ summary: 'Reserve a time slot' })
  @Public()
  async reserve(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(reserveSlotSchema)) dto: ReserveSlotDto,
  ) {
    return this.appointments.reserveSlot({ ...dto, practice_id: practiceId });
  }
}

// ─── Appointments (mixed auth) ──────────────────────────────────

@ApiTags('appointments')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  @Public()
  async create(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(createAppointmentSchema)) dto: CreateAppointmentDto,
    @Req() req: Request,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.appointments.createAppointment(
      { ...dto, practice_id: practiceId },
      user?.sub ?? null,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get()
  @ApiOperation({ summary: 'List appointments for a practice' })
  @UseGuards(PracticeRolesGuard)
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async list(
    @Param('practiceId') practiceId: string,
    @Query(new ZodValidationPipe(appointmentListQuerySchema))
    query: { status?: string; from?: string; to?: string; page?: number; limit?: number },
  ) {
    return this.appointments.listForPractice(practiceId, query);
  }

  @Get(':appointmentId')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @UseGuards(ParticipantGuard)
  async findById(@Param('appointmentId') appointmentId: string) {
    return this.appointments.findById(appointmentId);
  }

  @Post(':appointmentId/confirm')
  @ApiOperation({ summary: 'Confirm a pending appointment' })
  @UseGuards(PracticeRolesGuard)
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async confirm(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.appointments.confirmAppointment(appointmentId, userId);
  }

  @Post(':appointmentId/cancel')
  @ApiOperation({ summary: 'Cancel an appointment' })
  @UseGuards(ParticipantGuard)
  async cancel(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
    @Body(new ZodValidationPipe(cancelAppointmentSchema)) dto: CancelAppointmentDto,
  ) {
    return this.appointments.cancelAppointment(appointmentId, userId, dto);
  }

  @Post(':appointmentId/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment' })
  @UseGuards(ParticipantGuard)
  async reschedule(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
    @Body(new ZodValidationPipe(rescheduleAppointmentSchema)) dto: RescheduleAppointmentDto,
  ) {
    return this.appointments.rescheduleAppointment(appointmentId, dto, userId);
  }

  @Patch(':appointmentId/notes')
  @ApiOperation({ summary: 'Update appointment notes' })
  @UseGuards(ParticipantGuard)
  async updateNotes(
    @Param('appointmentId') appointmentId: string,
    @Body(new ZodValidationPipe(appointmentNotesSchema)) dto: AppointmentNotesDto,
  ) {
    return this.appointments.updateNotes(appointmentId, dto);
  }
}

// ─── Patient Appointments (user-scoped) ──────────────────────────

@ApiTags('appointments')
@ApiBearerAuth('JWT')
@Controller('me/appointments')
@UseGuards(JwtAuthGuard)
export class PatientAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List my appointments' })
  async list(
    @CurrentUser('sub') userId: string,
    @Query(new ZodValidationPipe(appointmentListQuerySchema))
    query: { status?: string; page?: number; limit?: number },
  ) {
    return this.appointments.listForPatient(userId, query);
  }
}
