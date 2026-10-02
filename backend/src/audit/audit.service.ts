import { Injectable } from '@nestjs/common';
import { AuditActor, Prisma } from '@prisma/client';
import { AuditLogService } from '../common/audit-log.service';

export type RecordAuditArgs = {
  firmId?: string | null;
  actor: AuditActor;
  actorUserId?: string | null;
  action: string;
  payload?: Prisma.InputJsonValue;
};

/**
 * Thin back-compat facade over the single audit sink, `AuditLogService`.
 *
 * Retained so existing callers keep their `record(...)` API, but all writes now
 * funnel through `AuditLogService.write` — one writer, one shape, one place that
 * handles RLS (firmId IS NULL admin/system rows) and swallow-on-error so an
 * audit failure never blocks the user-facing action.
 *
 * `payload` must already be PII-redacted (run it through `lib/pii-redactor.ts`).
 */
@Injectable()
export class AuditService {
  constructor(private readonly auditLog: AuditLogService) {}

  async record(args: RecordAuditArgs): Promise<void> {
    await this.auditLog.write({
      firmId: args.firmId ?? null,
      actor: args.actor,
      actorUserId: args.actorUserId ?? null,
      action: args.action,
      payload: args.payload as Record<string, unknown> | undefined,
    });
  }
}
