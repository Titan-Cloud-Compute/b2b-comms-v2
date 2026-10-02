import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditActor } from '@prisma/client';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AUDIT_KEY, type AuditMeta } from './audit.decorator';

/**
 * Global interceptor that writes an audit row for any handler carrying the
 * `@Audit()` decorator. Handlers without the decorator pass straight through,
 * so this is opt-in per endpoint despite being registered app-wide.
 *
 * The row records WHO (the acting user — the real admin even while
 * impersonating), WHAT (the dotted action), the TARGET (route params +
 * whitelisted body keys), and the OUTCOME (success/failure). Writes are
 * fire-and-forget through `AuditLogService`, which redacts nothing and swallows
 * its own errors, so auditing never blocks or breaks the user-facing action.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditLogService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const session = req.session;
    const actor =
      session?.role === 'ADMIN'
        ? AuditActor.ADMIN
        : session
          ? AuditActor.USER
          : AuditActor.SYSTEM;
    // Attribute to the human admin even when impersonating a firm.
    const actorUserId = session?.impersonatedBy ?? session?.userId ?? null;

    const params = (req.params ?? {}) as Record<string, string>;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const firmId =
      (meta.firmIdFrom?.param ? params[meta.firmIdFrom.param] : undefined) ??
      (meta.firmIdFrom?.body && typeof body[meta.firmIdFrom.body] === 'string'
        ? (body[meta.firmIdFrom.body] as string)
        : undefined) ??
      params['firmId'] ??
      (typeof body['firmId'] === 'string' ? (body['firmId'] as string) : undefined) ??
      session?.firmId ??
      null;

    const target: Record<string, unknown> = { ...params };
    if (meta.bodyKeys) {
      for (const key of meta.bodyKeys) {
        if (key in body) target[key] = body[key];
      }
    }

    const emit = (outcome: 'success' | 'failure', extra?: Record<string, unknown>): void => {
      void this.audit.write({
        actor,
        actorUserId,
        firmId,
        action: meta.action,
        payload: { outcome, method: req.method, path: req.path, target, ...extra },
      });
    };

    return next.handle().pipe(
      tap({
        next: () => emit('success'),
        error: (err: unknown) =>
          emit('failure', { error: err instanceof Error ? err.message : String(err) }),
      }),
    );
  }
}
