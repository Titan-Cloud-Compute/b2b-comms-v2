import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { SessionPayload } from './session.types';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

/**
 * JwtAuthGuard reads the session cookie (default name 'session'), verifies the
 * signed JWT, and attaches `req.session` for downstream handlers and guards.
 *
 * Routes decorated with `@Public()` bypass JWT validation entirely.
 * Throws 401 when the cookie is missing or the signature is invalid on
 * non-public routes.
 *
 * READ-ONLY IMPERSONATION: when the session carries `impersonatedBy` (an admin
 * viewing the app as a firm), mutating requests are rejected with 403 so the
 * admin cannot write as the firm (talk to agents, edit data, …). Exemptions:
 * the exit-impersonation/logout routes (the admin must always get back out)
 * and the integration route groups (IMPERSONATION_WRITE_PREFIXES) — admins
 * deliberately set up integrations on the firm's behalf via "View as company". Enforced HERE — rather than a standalone global guard —
 * because JwtAuthGuard is the sole interception point that runs on every
 * authenticated route AND has already populated `req.session` (there is no
 * global APP_GUARD in this app).
 */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Mutating routes still permitted while impersonating (must be able to exit). */
const IMPERSONATION_EXEMPT = ['/auth/exit-impersonation', '/auth/logout'];
/**
 * Route groups where impersonating admins MAY write (product decision
 * 2026-07-20): an admin uses "View as company" to set up integrations —
 * cloud-storage OAuth, bank connectors, declarative connections — on the
 * firm's behalf. Everything outside these prefixes stays read-only, and the
 * session still carries impersonatedBy so every such write is attributable.
 */
const IMPERSONATION_WRITE_PREFIXES = ['/api/integrations', '/api/connectors'];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger('JwtAuthGuard');

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'session';
    const raw = req.cookies?.[cookieName];
    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('not authenticated');
    }
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(raw);
    } catch (err) {
      this.logger.warn(`JWT verify failed: ${err instanceof Error ? err.message : err}`);
      throw new UnauthorizedException('invalid session');
    }
    req.session = payload;
    // Read-only enforcement for impersonation sessions (thrown OUTSIDE the
    // verify try/catch so the 403 is not masked as a 401).
    if (
      payload.impersonatedBy &&
      !READ_ONLY_METHODS.has(req.method) &&
      !IMPERSONATION_EXEMPT.some((p) => req.path.endsWith(p)) &&
      !IMPERSONATION_WRITE_PREFIXES.some((p) => req.path.startsWith(p))
    ) {
      throw new ForbiddenException('read-only: exit "view as company" to make changes');
    }
    return true;
  }
}
