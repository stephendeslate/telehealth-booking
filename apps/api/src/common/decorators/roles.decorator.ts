import { SetMetadata } from '@nestjs/common';
import type { UserRole, MembershipRole } from '@medconnect/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PRACTICE_ROLES_KEY = 'practiceRoles';
export const PracticeRoles = (...roles: MembershipRole[]) =>
  SetMetadata(PRACTICE_ROLES_KEY, roles);
