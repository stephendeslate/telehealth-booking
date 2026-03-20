import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { PracticeRolesGuard } from '../../common/guards/practice-roles.guard';
import { PracticeRoles } from '../../common/decorators/roles.decorator';
import { MembershipRole } from '@medconnect/shared';

@ApiTags('admin')
@ApiBearerAuth('JWT')
@Controller('practices/:practiceId/admin')
@UseGuards(PracticeRolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get practice analytics' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async getAnalytics(
    @Param('practiceId') practiceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getAnalytics(practiceId, { from, to });
  }

  @Get('patients')
  @ApiOperation({ summary: 'List practice patients' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async listPatients(
    @Param('practiceId') practiceId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPatients(practiceId, {
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('payments')
  @ApiOperation({ summary: 'List practice payments' })
  @PracticeRoles(MembershipRole.OWNER, MembershipRole.ADMIN)
  async listPayments(
    @Param('practiceId') practiceId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPayments(practiceId, {
      status,
      from,
      to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
