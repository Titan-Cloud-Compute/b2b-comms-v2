import { ApiClient } from './api-client.service';

// ---------------------------------------------------------------------------
// Org token panel — consumption, per-org allotments, scoped quota reset
// ---------------------------------------------------------------------------

/** One user's read/write LLM token split inside an organization. */
export interface TokenConsumptionUser {
  userId: string;
  email: string | null;
  name: string | null;
  /** Server-resolved display label (email → name → raw id). */
  userLabel: string;
  /** promptTokens + cachedTokens. */
  readTokens: number;
  /** completionTokens. */
  writeTokens: number;
  tokensUsed: number;
  costUsd: number;
  requestCount: number;
  /** This user's own 5-hour allotment, or null when they inherit the org's. */
  maxTokens5h?: number | null;
  /** This user's own weekly allotment, or null when they inherit the org's. */
  maxTokensWeekly?: number | null;
}

/**
 * Response of GET /api/admin/analytics/token-consumption. `used5h`/`usedWeekly`
 * are the tokens burned inside each rolling window; the matching `maxTokens*`
 * is the org's configured allotment, or `null` when no per-org cap is set.
 */
export interface TokenConsumption {
  firmId: string | null;
  perUser: TokenConsumptionUser[];
  totals: {
    readTokens: number;
    writeTokens: number;
    tokensUsed: number;
    costUsd: number;
    requestCount: number;
  };
  used5h: number;
  usedWeekly: number;
  maxTokens5h: number | null;
  maxTokensWeekly: number | null;
}

/**
 * Org-scoped token consumption: per-user read/write split, org totals, and
 * the tokens burned in each rolling window vs. the org's allotments. Backs
 * `#/admin/organizations?orgId=<id>&view=tokens`.
 */
export function getTokenConsumption(api: ApiClient, firmId?: string): Promise<TokenConsumption> {
  return api.get<TokenConsumption>('admin/analytics/token-consumption', {
    params: { firmId: firmId || undefined },
  });
}

/**
 * Set (or clear, by sending null) one organization's rolling token
 * allotments. Persisted as SystemSetting `TOKEN_LIMIT_5H:<firmId>` /
 * `TOKEN_LIMIT_WEEKLY:<firmId>` and enforced before the next LLM dispatch.
 */
export function setTokenLimits(
  api: ApiClient,
  input: {
    firmId: string;
    maxTokens5h: number | null;
    maxTokensWeekly: number | null;
  },
): Promise<TokenLimitsResult> {
  return api.patch('admin/analytics/token-limits', {
    firmId: input.firmId,
    maxTokens5h: input.maxTokens5h,
    maxTokensWeekly: input.maxTokensWeekly,
  });
}

/** Echo of a token-limit write; `firmId`/`userId` say which scope was set. */
export interface TokenLimitsResult {
  ok: true;
  firmId: string | null;
  userId?: string | null;
  maxTokens5h: number | null;
  maxTokensWeekly: number | null;
}

/**
 * Set (or clear, by sending null) ONE user's personal rolling allotments —
 * stored as `TOKEN_LIMIT_5H:user:<userId>` / `TOKEN_LIMIT_WEEKLY:user:<userId>`
 * and enforced ahead of the organization-wide cap. This is how an operator
 * adjusts how much a single person is allowed to use.
 */
export function setUserTokenLimits(
  api: ApiClient,
  input: {
    userId: string;
    maxTokens5h: number | null;
    maxTokensWeekly: number | null;
  },
): Promise<TokenLimitsResult> {
  return api.patch('admin/analytics/token-limits', {
    userId: input.userId,
    maxTokens5h: input.maxTokens5h,
    maxTokensWeekly: input.maxTokensWeekly,
  });
}

/**
 * Zero the CONSUMED chat quota for the given users (their `quotaResetAt`
 * epoch moves forward — the append-only `LlmUsage` cost ledger is never
 * deleted). An empty/omitted `userIds` means EVERY user, so callers that mean
 * "this org" must always pass the org's explicit user ids.
 */
export function resetTokenUsage(api: ApiClient, userIds: string[]): Promise<{ usersReset: number }> {
  return api.post<{ usersReset: number }>('admin/tokens/reset', { userIds });
}
