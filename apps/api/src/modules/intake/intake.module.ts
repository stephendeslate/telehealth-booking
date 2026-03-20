import { Module } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { IntakeTemplateController, IntakeSubmissionController } from './intake.controller';

@Module({
  controllers: [IntakeTemplateController, IntakeSubmissionController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
