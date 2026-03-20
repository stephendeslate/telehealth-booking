import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PRACTICE_ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenError } from '../errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { MembershipRole } from '@medconnect/shared';

@Injectable()
export class PracticeRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      PRACTICE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenError();
    }

    // PLATFORM_ADMIN bypasses practice role checks
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    const practiceId = request.params.practiceId || request.headers['x-practice-id'];
    if (!practiceId) {
      throw new ForbiddenError('Practice context required');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        practice_id_user_id: {
          practice_id: practiceId,
          user_id: user.sub,
        },
      },
    });

    if (!membership || !membership.is_active) {
      throw new ForbiddenError('Not a member of this practice');
    }

    if (!requiredRoles.includes(membership.role as MembershipRole)) {
      throw new ForbiddenError();
    }

    // Attach membership info to request for downstream use
    request.membership = membership;
    return true;
  }
}
