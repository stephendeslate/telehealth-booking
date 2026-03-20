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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('services')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/services')
@UseGuards(PracticeRolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async create(
    @Param('practiceId') practiceId: string,
    @Body(new ZodValidationPipe(createServiceSchema)) dto: CreateServiceDto,
  ) {
    return this.servicesService.create(practiceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List services for a practice' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async list(@Param('practiceId') practiceId: string) {
    return this.servicesService.list(practiceId);
  }

  @Get(':serviceId')
  @ApiOperation({ summary: 'Get service by ID' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async findById(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.findById(practiceId, serviceId);
  }

  @Patch(':serviceId')
  @ApiOperation({ summary: 'Update a service' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async update(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(practiceId, serviceId, dto);
  }

  @Delete(':serviceId')
  @ApiOperation({ summary: 'Delete a service' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async delete(
    @Param('practiceId') practiceId: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.servicesService.delete(practiceId, serviceId);
  }
}
