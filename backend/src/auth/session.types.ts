import type { UserRole } from '@prisma/client';

/**
 * The JWT payload signed into the session cookie. We deliberately keep this
 * tiny — anything else (firm name, settings, etc.) must be fetched per request
 * so it stays fresh after admin edits.
 */
export interface SessionPayload {
  userId: string;
  role: UserRole;
  firmId: string | null;
  /**
   * Admin impersonation marker: when set, this session is an ADMIN viewing the
   * app AS the firm in `firmId` (role downgraded to USER). Holds the real
   * admin userId so the session can be exited and every action stays
   * attributable. Its presence also flips the session to READ-ONLY (see
   * JwtAuthGuard). Absent on all normal sessions → replay-safe for old tokens.
   */
  impersonatedBy?: string;
  /** iat / exp set automatically by @nestjs/jwt */
}

/** Express request augmentation so handlers see `req.session` after JwtAuthGuard runs. */
declare module 'express' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Request {
    session?: SessionPayload;
  }
}
