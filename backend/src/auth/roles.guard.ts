import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'allowed_roles';

/**
 * Decorator: attach the set of allowed roles to a handler/controller.
 * Use with @UseGuards(JwtAuthGuard, RolesGuard) — JwtAuthGuard must run first
 * to populate req.session.
 *
 * Convenience aliases:
 *   @RequireUser()   — any authenticated user (USER, MANAGER, ADMIN)
 *   @RequireAdmin()  — ADMIN only
 */
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);

export const RequireUser = (): ReturnType<typeof SetMetadata> =>
  Roles('USER', 'MANAGER', 'ADMIN');
export const RequireFirmUser = (): ReturnType<typeof SetMetadata> =>
  Roles('USER', 'MANAGER', 'ADMIN');
export const RequireAdmin = (): ReturnType<typeof SetMetadata> =>
  Roles('ADMIN');

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true; // no @Roles → unrestricted (after JwtAuthGuard)

    const req = ctx.switchToHttp().getRequest<Request>();
    const session = req.session;
    if (!session) throw new UnauthorizedException('not authenticated');
    if (!allowed.includes(session.role)) {
      throw new ForbiddenException(`role ${session.role} not allowed for this endpoint`);
    }
    return true;
  }
}
