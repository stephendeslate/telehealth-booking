import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IntakeService } from './intake.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { ParticipantGuard } from '../../common/guards/participant.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createIntakeTemplateSchema,
  updateIntakeTemplateSchema,
  submitIntakeSchema,
  MembershipRole,
} from '@medconnect/shared';
import type {
  CreateIntakeTemplateDto,
  UpdateIntakeTemplateDto,
  SubmitIntakeDto,
} from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';

// Template CRUD — practice-scoped, OWNER/ADMIN only
@Controller('practices/:practiceId/intake-templates')
@UseGuards(PracticeRolesGuard)
export class IntakeTemplateController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post()
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async create(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(createIntakeTemplateSchema)) dto: CreateIntakeTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.intakeService.createTemplate(practiceId, dto, user.sub);
  }

  @Get()
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async list(@Param('practiceId') practiceId: string) {
    return this.intakeService.listTemplates(practiceId);
  }

  @Get(':templateId')
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async findById(
    @Param('practiceId') practiceId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.intakeService.getTemplate(practiceId, templateId);
  }

  @Patch(':templateId')
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async update(
    @Param('practiceId') practiceId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(updateIntakeTemplateSchema)) dto: UpdateIntakeTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.intakeService.updateTemplate(practiceId, templateId, dto, user.sub);
  }
}

// Intake submission — appointment-scoped (patient or practice member)
// ParticipantGuard attaches appointment to request
@Controller('appointments/:appointmentId/intake')
@UseGuards(ParticipantGuard)
export class IntakeSubmissionController {
  constructor(private readonly intakeService: IntakeService) {}

  @Get()
  async getSubmission(
    @Param('appointmentId') appointmentId: string,
    @Req() req: any,
  ) {
    const practiceId = req.appointment.practice_id;
    return this.intakeService.getSubmission(practiceId, appointmentId);
  }

  @Post()
  async submit(
    @Param('appointmentId') appointmentId: string,
    @Body(new ZodValidationPipe(submitIntakeSchema)) dto: SubmitIntakeDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: any,
  ) {
    const practiceId = req.appointment.practice_id;
    return this.intakeService.submitIntake(practiceId, appointmentId, dto, user.sub);
  }
}
