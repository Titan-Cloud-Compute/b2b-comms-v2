import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit:meta';

export interface AuditMeta {
  /** Dotted action name, e.g. `integration.pause`. */
  action: string;
  /**
   * Body keys to copy into the audit payload. WHITELIST only — the interceptor
   * never dumps the whole request body, because integration configs and token
   * fields carry secrets. List only non-sensitive fields worth recording.
   */
  bodyKeys?: string[];
  /**
   * Where to read the target firmId for the audit row. Falls back to a `firmId`
   * route param, then a `firmId` body field, then the actor's session firmId.
   */
  firmIdFrom?: { param?: string; body?: string };
}

/**
 * Mark a handler for audit logging. A single global `AuditInterceptor` writes
 * one immutable `AuditLog` row per invocation (success or failure) via
 * `AuditLogService`, capturing the acting user, the action, and the target.
 *
 * Opt-in per endpoint by design: adding `@Audit('<domain>.<verb>')` is the
 * convention, so a new admin mutation cannot silently ship un-audited, and the
 * decorator sits right next to the route it describes.
 */
export const Audit = (
  action: string,
  opts: Omit<AuditMeta, 'action'> = {},
): MethodDecorator => SetMetadata(AUDIT_KEY, { action, ...opts } satisfies AuditMeta);
