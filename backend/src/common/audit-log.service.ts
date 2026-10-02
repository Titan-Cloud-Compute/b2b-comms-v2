import { Injectable, Logger } from '@nestjs/common';
import { AuditActor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface WriteParams {
  firmId?: string | null;
  actor: AuditActor;
  actorUserId?: string | null;
  action: string;
  payload?: Record<string, unknown>;
  /**
   * If provided, the audit row is written inside this existing transaction
   * (so it commits or rolls back atomically with the caller's domain write).
   * Otherwise we open a short admin transaction so the row gets written even
   * when the caller has no firmId context yet (e.g. failed signup attempt).
   */
  tx?: Prisma.TransactionClient;
}

/**
 * Centralised audit-log writer. All security-relevant events go through here.
 *
 * IMPORTANT: payload must already be PII-redacted. The PII redactor returns
 * `events` describing what was redacted — pass those events here, NOT the
 * original PII strings.
 */
@Injectable()
export class AuditLogService {
  private readonly log = new Logger('AuditLogService');

  constructor(private readonly prisma: PrismaService) {}

  async write(params: WriteParams): Promise<void> {
    const data = {
      firmId: params.firmId ?? null,
      actor: params.actor,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      payloadJson: (params.payload ?? {}) as Prisma.InputJsonValue,
    };

    try {
      if (params.tx) {
        await params.tx.auditLog.create({ data });
      } else {
        // No caller transaction → open an admin tx so RLS doesn't block the
        // insert for firmId=null events (signup failures, system jobs).
        await this.prisma.runAsAdmin((tx) => tx.auditLog.create({ data }));
      }
    } catch (err) {
      // Audit writes must never block the user-facing action. Log and swallow.
      this.log.error(
        `audit write failed for action=${params.action}: ${(err as Error).message}`,
      );
    }
  }
}
