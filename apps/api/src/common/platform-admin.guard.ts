import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';

const ADMIN_ROLES: PlatformRole[] = [
  PlatformRole.SUPER_ADMIN,
  PlatformRole.ADMIN,
];

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { platformRole?: PlatformRole } }>();
    const role = req.user?.platformRole;
    if (!role || !ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException('Admin role required');
    }
    return true;
  }
}
