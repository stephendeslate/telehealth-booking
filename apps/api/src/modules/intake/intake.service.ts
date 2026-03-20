import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../common/errors/app-error';
import type { CreateIntakeTemplateDto, UpdateIntakeTemplateDto, SubmitIntakeDto } from '@medconnect/shared';

// 3 system presets per spec
const SYSTEM_PRESETS = [
  {
    name: 'General Health Intake',
    description: 'Standard intake form for general health consultations.',
    fields: [
      { id: 'chief_complaint', type: 'TEXTAREA', label: 'Chief Complaint', required: true, placeholder: 'Describe your main concern' },
      { id: 'current_medications', type: 'TEXTAREA', label: 'Current Medications', required: false, placeholder: 'List all current medications' },
      { id: 'allergies', type: 'TEXTAREA', label: 'Allergies', required: false, placeholder: 'List any known allergies' },
      { id: 'medical_history', type: 'TEXTAREA', label: 'Medical History', required: false, placeholder: 'Previous diagnoses, surgeries, etc.' },
      { id: 'emergency_contact_name', type: 'TEXT', label: 'Emergency Contact Name', required: true },
      { id: 'emergency_contact_phone', type: 'PHONE', label: 'Emergency Contact Phone', required: true },
    ],
  },
  {
    name: 'Dental Intake',
    description: 'Intake form for dental consultations.',
    fields: [
      { id: 'dental_concern', type: 'TEXTAREA', label: 'Dental Concern', required: true, placeholder: 'Describe your dental issue' },
      { id: 'last_dental_visit', type: 'DATE', label: 'Last Dental Visit', required: false },
      { id: 'dental_anxiety', type: 'SELECT', label: 'Dental Anxiety Level', required: true, options: ['None', 'Mild', 'Moderate', 'Severe'] },
      { id: 'current_medications', type: 'TEXTAREA', label: 'Current Medications', required: false },
      { id: 'allergies', type: 'TEXTAREA', label: 'Allergies', required: false },
      { id: 'brushing_frequency', type: 'SELECT', label: 'Brushing Frequency', required: false, options: ['Once daily', 'Twice daily', 'Three+ times daily'] },
    ],
  },
  {
    name: 'Mental Health Intake',
    description: 'Intake form for mental health consultations.',
    fields: [
      { id: 'reason_for_visit', type: 'TEXTAREA', label: 'Reason for Visit', required: true, placeholder: 'What brings you in today?' },
      { id: 'current_symptoms', type: 'MULTI_SELECT', label: 'Current Symptoms', required: true, options: ['Anxiety', 'Depression', 'Insomnia', 'Stress', 'Grief', 'Trauma', 'Relationship Issues', 'Other'] },
      { id: 'symptom_duration', type: 'SELECT', label: 'How long have you experienced these symptoms?', required: true, options: ['Less than 2 weeks', '2-4 weeks', '1-3 months', '3-6 months', '6+ months'] },
      { id: 'previous_therapy', type: 'CHECKBOX', label: 'Have you been in therapy before?', required: false },
      { id: 'current_medications', type: 'TEXTAREA', label: 'Current Medications', required: false },
      { id: 'emergency_contact_name', type: 'TEXT', label: 'Emergency Contact Name', required: true },
      { id: 'emergency_contact_phone', type: 'PHONE', label: 'Emergency Contact Phone', required: true },
    ],
  },
];

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create system presets for a practice (called when a practice is created).
   */
  async createSystemPresets(practiceId: string): Promise<void> {
    for (const preset of SYSTEM_PRESETS) {
      await this.prisma.intakeFormTemplate.create({
        data: {
          practice_id: practiceId,
          name: preset.name,
          description: preset.description,
          fields: preset.fields as any,
          is_system: true,
          is_active: true,
        },
      });
    }
  }

  async createTemplate(practiceId: string, dto: CreateIntakeTemplateDto, userId: string) {
    const template = await this.prisma.intakeFormTemplate.create({
      data: {
        practice_id: practiceId,
        name: dto.name,
        description: dto.description,
        fields: dto.fields as any,
        is_active: dto.is_active ?? true,
      },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: practiceId,
      action: 'INTAKE_TEMPLATE_CREATED' as any,
      resource_type: 'IntakeFormTemplate',
      resource_id: template.id,
    });

    return template;
  }

  async listTemplates(practiceId: string) {
    return this.prisma.intakeFormTemplate.findMany({
      where: { practice_id: practiceId },
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
    });
  }

  async getTemplate(practiceId: string, templateId: string) {
    const template = await this.prisma.intakeFormTemplate.findFirst({
      where: { id: templateId, practice_id: practiceId },
    });
    if (!template) throw new NotFoundError('Intake template not found');
    return template;
  }

  async updateTemplate(practiceId: string, templateId: string, dto: UpdateIntakeTemplateDto, userId: string) {
    const existing = await this.getTemplate(practiceId, templateId);
    if (existing.is_system) {
      throw new ForbiddenError('System templates cannot be modified');
    }

    const updated = await this.prisma.intakeFormTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fields !== undefined && { fields: dto.fields as any }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    await this.audit.log({
      user_id: userId,
      practice_id: practiceId,
      action: 'INTAKE_TEMPLATE_UPDATED' as any,
      resource_type: 'IntakeFormTemplate',
      resource_id: templateId,
    });

    return updated;
  }

  async getSubmission(practiceId: string, appointmentId: string) {
    const submission = await this.prisma.intakeSubmission.findFirst({
      where: { appointment_id: appointmentId, practice_id: practiceId },
      include: { template: true },
    });
    return submission;
  }

  async submitIntake(practiceId: string, appointmentId: string, dto: SubmitIntakeDto, userId: string) {
    // Verify appointment exists and belongs to this practice
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, practice_id: practiceId },
      include: { service: true, intake_submission: true },
    });
    if (!appointment) throw new NotFoundError('Appointment not found');

    // Check if already submitted and completed
    if (appointment.intake_submission?.status === 'COMPLETED') {
      throw new ConflictError('Intake form already completed');
    }

    // Get template from service
    const templateId = appointment.service.intake_form_template_id;
    if (!templateId) {
      throw new NotFoundError('This service does not have an intake form');
    }

    const now = new Date();

    // Upsert — update if PENDING, create if not exists
    const submission = appointment.intake_submission
      ? await this.prisma.intakeSubmission.update({
          where: { id: appointment.intake_submission.id },
          data: {
            form_data: dto.form_data as any,
            status: 'COMPLETED',
            completed_at: now,
          },
          include: { template: true },
        })
      : await this.prisma.intakeSubmission.create({
          data: {
            practice_id: practiceId,
            appointment_id: appointmentId,
            template_id: templateId,
            form_data: dto.form_data as any,
            status: 'COMPLETED',
            completed_at: now,
          },
          include: { template: true },
        });

    await this.audit.log({
      user_id: userId,
      practice_id: practiceId,
      action: 'INTAKE_SUBMITTED' as any,
      resource_type: 'IntakeSubmission',
      resource_id: submission.id,
      metadata: { appointmentId },
    });

    return submission;
  }
}
