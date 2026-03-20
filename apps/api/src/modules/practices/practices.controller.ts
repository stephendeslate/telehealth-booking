import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PracticesService } from './practices.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPracticeSchema,
  updatePracticeSchema,
  practiceSettingsSchema,
  MembershipRole,
} from '@medconnect/shared';
import type {
  CreatePracticeDto,
  UpdatePracticeDto,
  PracticeSettingsDto,
} from '@medconnect/shared';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('practices')
@ApiBearerAuth('JWT')
@Controller('practices')
export class PracticesController {
  constructor(private readonly practicesService: PracticesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new practice' })
  async create(
    @Body(new ZodValidationPipe(createPracticeSchema)) dto: CreatePracticeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.practicesService.create(dto, user.sub);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List practices for current user' })
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.practicesService.listForUser(user.sub);
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({ summary: 'Get public practice profile by slug' })
  async getPublicProfile(@Param('slug') slug: string) {
    return this.practicesService.getPublicProfile(slug);
  }

  @Get(':practiceId')
  @ApiOperation({ summary: 'Get practice by ID' })
  @UseGuards(PracticeRolesGuard)
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.PROVIDER)
  async findById(@Param('practiceId') id: string) {
    return this.practicesService.findById(id);
  }

  @Patch(':practiceId')
  @ApiOperation({ summary: 'Update practice details' })
  @UseGuards(PracticeRolesGuard)
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async update(
    @Param('practiceId') id: string,
    @Body(new ZodValidationPipe(updatePracticeSchema)) dto: UpdatePracticeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.practicesService.update(id, dto, user.sub);
  }

  @Patch(':practiceId/settings')
  @ApiOperation({ summary: 'Update practice settings' })
  @UseGuards(PracticeRolesGuard)
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async updateSettings(
    @Param('practiceId') id: string,
    @Body(new ZodValidationPipe(practiceSettingsSchema)) dto: PracticeSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.practicesService.updateSettings(id, dto, user.sub);
  }
}
