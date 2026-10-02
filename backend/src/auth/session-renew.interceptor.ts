import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { Observable, from, switchMap } from 'rxjs';
import type { SessionPayload } from './session.types';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  sessionCookieOptions,
} from './session-cookie';

/** JWT claims present at runtime after verifyAsync (not in SessionPayload). */
type SessionClaims = SessionPayload & { iat?: number; exp?: number };

/**
 * Sliding (rolling) session expiration. Sessions are fixed-lifetime JWTs, so
 * without renewal an ACTIVE user is logged out exactly N days after signing
 * in, mid-task — the "sent back to login" complaint. This interceptor
 * re-issues the session cookie with a fresh window whenever an authenticated
 * request arrives past the token's HALF-LIFE, so only a user genuinely away
 * for the full lifetime ever sees the login page again.
 *
 * Half-life threshold (not every request) keeps the re-sign off the hot path:
 * at most one renewal per half-lifetime per client, and old cookies stay
 * valid until their original exp (renewal replaces, never revokes).
 *
 * Skips impersonation sessions: an admin "view as company" session is meant
 * to be short-lived and should expire on its original schedule, not be
 * silently extended by activity.
 *
 * The cookie must be set BEFORE the response streams, so the re-sign runs
 * ahead of next.handle() rather than in a tap() after it.
 */
@Injectable()
export class SessionRenewInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SessionRenew');

  constructor(private readonly jwt: JwtService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const session = req.session as SessionClaims | undefined;
    if (!this.shouldRenew(session)) return next.handle();

    const res = ctx.switchToHttp().getResponse<Response>();
    return from(this.reissue(session!, res)).pipe(switchMap(() => next.handle()));
  }

  private shouldRenew(session: SessionClaims | undefined): boolean {
    if (!session?.iat || !session.exp || session.impersonatedBy) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    const halfLife = (session.exp - session.iat) / 2;
    return nowSec - session.iat > halfLife;
  }

  private async reissue(session: SessionClaims, res: Response): Promise<void> {
    try {
      // Strip iat/exp: signAsync rejects a payload that already carries exp
      // when signOptions.expiresIn is set (the module default provides it).
      const { iat: _iat, exp: _exp, ...payload } = session;
      const token = await this.jwt.signAsync(payload);
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(SESSION_MAX_AGE_MS));
    } catch (err) {
      // Fail-open: renewal is best-effort; the current request is already
      // authenticated and must not fail because a re-sign hiccuped.
      this.logger.warn(
        `session renewal failed (request continues): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
