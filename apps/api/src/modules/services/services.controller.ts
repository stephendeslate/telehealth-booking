import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createServiceSchema,
  updateServiceSchema,
  MembershipRole,
} from '@medconnect/shared';
import type { CreateServiceDto, UpdateServiceDto } from '@medconnect/shared';

@Controller('practices/:practiceId/services')
@UseGuards(PracticeRolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async create(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(createServiceSchema)) dto: CreateServiceDto,
  ) {
    return this.servicesService.create(practiceId, dto);
  }

  @Get()
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async list(@Param('practiceId') practiceId: string) {
    return this.servicesService.list(practiceId);
  }

  @Get(':serviceId')
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async findById(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.findById(practiceId, serviceId);
  }

  @Patch(':serviceId')
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async update(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(practiceId, serviceId, dto);
  }

  @Delete(':serviceId')
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async delete(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.delete(practiceId, serviceId);
  }
}
