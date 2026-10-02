import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import {
  getTokenConsumption,
  setTokenLimits,
  setUserTokenLimits,
  resetTokenUsage,
} from './admin-token-consumption-api';
import type { TokenLimitsResult } from './admin-token-consumption-api';

// Re-exported so existing importers of these types keep working.
export type {
  TokenConsumption,
  TokenConsumptionUser,
} from './admin-token-consumption-api';
import type { TokenConsumption } from './admin-token-consumption-api';

// ---------------------------------------------------------------------------
// Registration tokens
// ---------------------------------------------------------------------------

export interface RegistrationToken {
  token: string;
  createdAt: string;
  createdBy: { id: string; email: string } | null;
  consumed: boolean;
  consumedAt: string | null;
  consumedBy: { id: string; email: string; firmId: string | null } | null;
}

// ---------------------------------------------------------------------------
// App settings — opaque-by-design. Values never round-trip through the wire.
// ---------------------------------------------------------------------------

export type SettingKey =
  | 'DATABASE_URL'
  | 'PG_HOST'
  | 'PG_PORT'
  | 'PG_USER'
  | 'PG_PASSWORD'
  | 'PG_DATABASE'
  | 'MINIO_ENDPOINT'
  | 'MINIO_ACCESS_KEY'
  | 'MINIO_SECRET_KEY'
  | 'MINIO_BUCKET'
  | 'S3_ENDPOINT'
  | 'S3_ACCESS_KEY'
  | 'S3_SECRET_KEY'
  | 'REDIS_URL'
  | 'REDIS_HOST'
  | 'REDIS_PORT'
  | 'REDIS_PASSWORD'
  | 'LITELLM_BASE_URL'
  | 'LITELLM_API_KEY'
  | 'OPENAI_API_BASE'
  | 'OPENAI_API_KEY'
  | 'OPENAI_MODEL'
  | 'OPENAI_EMBED_MODEL'
  | 'ANTHROPIC_API_KEY'
  | 'GLM_BASE_URL'
  | 'GLM_API_KEY'
  | 'GLM_MODEL'
  | 'BGGPT_BASE_URL'
  | 'BGGPT_API_KEY'
  | 'TWILIO_ACCOUNT_SID'
  | 'TWILIO_AUTH_TOKEN'
  | 'TWILIO_WHATSAPP_FROM'
  | 'TWILIO_WEBHOOK_URL'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_SECURE'
  | 'SMTP_USER'
  | 'SMTP_PASSWORD'
  | 'EMAIL_FROM'
  | 'APP_PUBLIC_URL'
  | 'GDPR_CONSENT_TEXT'
  | 'JWT_SECRET'
  | 'WEB_SEARCH_API_KEY'
  | 'TRANSLATION_PIPELINE_ENABLED';

export interface SettingRow {
  key: SettingKey;
  configured: boolean;
  /**
   * The stored value when the key is plain configuration (`secret: false` — a
   * host, port, mailbox address or public URL), otherwise a display-only masked
   * preview (short leading prefix then bullets, e.g. `sk-a••••••••`). `null`
   * when not configured. A masked preview must not be written back on save.
   */
  maskedValue: string | null;
  /** True when the value is a credential and `maskedValue` is only a preview. */
  secret: boolean;
  source: 'env' | 'db' | null;
  updatedAt: string | null;
}

export interface PatchSettingsInput {
  key: SettingKey;
  value: string;
}

// ---------------------------------------------------------------------------
// Users — cross-firm admin listing + manual provisioning
// ---------------------------------------------------------------------------

export type AdminUserRole = 'ADMIN' | 'USER';

/** A single user row returned by GET /admin/users (cross-firm, admin scope). */
export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: AdminUserRole;
  firmId: string | null;
  createdAt: string;
  /** Date of the user's most recent conversation message, or null when none. */
  lastConversationAt?: string | null;
  firm?: { name: string | null } | null;
  /**
   * One-time generated temporary password, present ONLY on the POST /admin/users
   * create response (never on listings). Transient — never persisted or put in a
   * URL; surfaced once in the reveal modal then discarded.
   */
  temporaryPassword?: string;
}

/**
 * Payload for POST /admin/users.
 */
export interface CreateUserInput {
  name: string;
  email: string;
  role: 'ADMIN';
  firmId: string | null;
}

/**
 * Payload for PATCH /admin/users/:id — the grant/revoke-admin path.
 */
export interface UpdateUserRoleInput {
  role: 'ADMIN';
  firmId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private api = inject(ApiClient);

  // ----- org token consumption / allotments -----

  /** @see getTokenConsumption in `./admin-token-consumption-api`. */
  getTokenConsumption(firmId?: string): Promise<TokenConsumption> {
    return getTokenConsumption(this.api, firmId);
  }

  /** @see setTokenLimits in `./admin-token-consumption-api`. */
  setTokenLimits(input: {
    firmId: string;
    maxTokens5h: number | null;
    maxTokensWeekly: number | null;
  }): Promise<TokenLimitsResult> {
    return setTokenLimits(this.api, input);
  }

  /** @see setUserTokenLimits in `./admin-token-consumption-api`. */
  setUserTokenLimits(input: {
    userId: string;
    maxTokens5h: number | null;
    maxTokensWeekly: number | null;
  }): Promise<TokenLimitsResult> {
    return setUserTokenLimits(this.api, input);
  }

  /** @see resetTokenUsage in `./admin-token-consumption-api`. */
  resetTokenUsage(userIds: string[]): Promise<{ usersReset: number }> {
    return resetTokenUsage(this.api, userIds);
  }

  // ----- tokens -----

  /**
   * Create registration tokens carrying a model grant (token-tier invites):
   * the redeeming user is entitled to exactly `grantedModelIds`
   * (mistral-medium-3.5 | claude-opus-4-7 | both). Empty = legacy
   * unrestricted token.
   */
  createTokens(
    count = 1,
    grantedModelIds: string[] = [],
  ): Promise<{ tokens: string[]; grantedModelIds: string[] }> {
    return this.api.post<{ tokens: string[]; grantedModelIds: string[] }>(
      'admin/tokens',
      { count, grantedModelIds },
    );
  }

  listTokens(): Promise<RegistrationToken[]> {
    return this.api.get<RegistrationToken[]>('admin/tokens');
  }

  /** Returns the URL of the CSV export — fetch via window.location or a link. */
  tokensExportUrl(): string {
    return this.api.url('admin/tokens/export.csv');
  }

  revokeToken(token: string): Promise<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`admin/tokens/${token}`);
  }

  /**
   * Download every organization with its contact details as a CSV blob.
   *
   * Server-rendered rather than built from the loaded rows (the way the token
   * export is): the contact columns are personal data the organizations table
   * never displays, so they are fetched only on an explicit export, and the
   * server records an audit row for it.
   */

  // ----- users -----

  /**
   * List every user across all firms. Supports an optional case-insensitive
   * `q` search (name/email) and an exact `role` filter.
   */
  listUsers(q?: string, role?: string): Promise<AdminUserRow[]> {
    return this.api.get<AdminUserRow[]>('admin/users', {
      params: { q: q || undefined, role: role || undefined },
    });
  }

  /**
   * Provision a new account. The backend re-validates and audits the mutation.
   */
  createUser(input: CreateUserInput): Promise<AdminUserRow> {
    return this.api.post<AdminUserRow>('admin/users', input);
  }

  /**
   * Change a user's role (grant/revoke admin). The backend re-validates the
   * admin-vs-firm exclusivity and audits the change, returning the updated row.
   */
  updateUserRole(id: string, input: UpdateUserRoleInput): Promise<AdminUserRow> {
    return this.api.patch<AdminUserRow>(`admin/users/${id}`, input);
  }

  /**
   * Generate a fresh one-time temporary password for an existing user. The
   * plaintext `temporaryPassword` is returned once only (never persisted or put
   * in a URL) and surfaced in the reveal modal, mirroring createUser().
   */
  resetPassword(id: string): Promise<{ id: string; temporaryPassword: string }> {
    return this.api.post<{ id: string; temporaryPassword: string }>(
      `admin/users/${id}/reset-password`,
      {},
    );
  }

  /**
   * Hard-delete a user account (DELETE /admin/users/:id). Irreversible: the
   * account and its personal data are removed, while the user's firm/org and
   * its documents survive (documents are detached, their owner set to null).
   * The backend re-checks admin scope and audits the deletion.
   */
  deleteUser(id: string): Promise<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`admin/users/${id}`);
  }

  // ----- settings -----

  getSettings(): Promise<SettingRow[]> {
    return this.api.get<SettingRow[]>('admin/settings');
  }

  updateSettings(
    rows: PatchSettingsInput[],
  ): Promise<{ ok: true; updated: number }> {
    return this.api.patch<{ ok: true; updated: number }>('admin/settings', rows);
  }

  /** Test a named service connection. Returns ok, latencyMs, and optional error. */
  testConnection(service: 'minio' | 'postgres' | 'redis' | 'litellm' | 'embedding' | 'bggpt' | 'email'): Promise<{
    ok: boolean;
    latencyMs: number;
    error?: string;
  }> {
    return this.api.post<{ ok: boolean; latencyMs: number; error?: string }>(
      `admin/settings/test/${service}`,
      {},
    );
  }

  /** Send a real test email through the configured SMTP settings. */
  sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
    return this.api.post<{ ok: boolean; error?: string }>(
      'admin/settings/test-email',
      { to },
    );
  }

  // ----- email console -----

  /**
   * Send a one-off email to explicit recipients, optionally with files.
   *
   * `cc` is optional and, when given, is carried on exactly ONE outgoing
   * message by the server — a copied colleague gets a single copy, never one
   * per To recipient.
   */
  sendEmail(
    to: string[],
    subject: string,
    body: string,
    attachments: EmailAttachmentInput[] = [],
    cc: string[] = [],
  ): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
    return this.api.post<{ ok: boolean; sent: number; failed: number; error?: string }>(
      'admin/email/send',
      {
        to,
        subject,
        body,
        ...(attachments.length ? { attachments } : {}),
        ...(cc.length ? { cc } : {}),
      },
    );
  }

  /**
   * The merge fields an admin may use. Server-owned: this is the same registry
   * the renderer and the save-time validator read, so the picker can never
   * offer a tag the sender cannot fill.
   */
  emailMergeFields(): Promise<{ fields: EmailMergeField[] }> {
    return this.api.get<{ fields: EmailMergeField[] }>('admin/email/merge-fields');
  }

  /** Render a draft the way the send path will render it (no mail is sent). */
  emailPreview(subject: string, body: string, sampleEmail?: string): Promise<EmailPreview> {
    return this.api.post<EmailPreview>('admin/email/preview', {
      subject,
      body,
      ...(sampleEmail ? { sampleEmail } : {}),
    });
  }

  /** Recipient counts for a fleet-wide broadcast scope. */
  emailRecipients(scope: 'all' | 'owners'): Promise<{ scope: string; total: number; suppressed: number; sendable: number; sample: string[] }> {
    return this.api.get<{ scope: string; total: number; suppressed: number; sendable: number; sample: string[] }>(
      `admin/email/recipients?scope=${scope}`,
    );
  }

  /** Send a fleet-wide broadcast (suppression-aware, with unsubscribe). */
  broadcastEmail(scope: 'all' | 'owners', subject: string, body: string): Promise<{ ok: boolean; sent: number; failed: number; skipped: number; total: number; error?: string }> {
    return this.api.post<{ ok: boolean; sent: number; failed: number; skipped: number; total: number; error?: string }>(
      'admin/email/broadcast',
      { scope, subject, body },
    );
  }

  /** Current email suppression (unsubscribe) list. */
  /**
   * Verify SMTP settings the admin has typed but not yet saved. Omit a field to
   * fall back to the stored value (that is how an untouched masked password is
   * tested without sending the mask back to the server).
   */
  testSmtpSettings(input: {
    host?: string;
    port?: number;
    secure?: string;
    user?: string;
    password?: string;
    from?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    return this.api.post<{ ok: boolean; error?: string }>('admin/settings/test-smtp', input);
  }

  emailSuppressions(): Promise<Array<{ email: string; reason: string; createdAt: string }>> {
    return this.api.get<Array<{ email: string; reason: string; createdAt: string }>>('admin/email/suppressions');
  }

  // ----- reminder campaigns -----

  /** All reminder campaigns, newest first. */
  emailCampaigns(): Promise<EmailCampaign[]> {
    return this.api.get<EmailCampaign[]>('admin/email/campaigns');
  }

  /** How many people a target scope currently reaches. */
  emailCampaignPreview(scope: EmailCampaignScope, inactiveDays: number): Promise<{ scope: string; inactiveDays: number; recipients: number; sample: string[] }> {
    return this.api.get<{ scope: string; inactiveDays: number; recipients: number; sample: string[] }>(
      `admin/email/campaigns/preview?scope=${scope}&inactiveDays=${inactiveDays}`,
    );
  }

  /** Create a reminder campaign. */
  createEmailCampaign(input: EmailCampaignInput): Promise<{ ok: boolean; campaign?: EmailCampaign; error?: string }> {
    return this.api.post<{ ok: boolean; campaign?: EmailCampaign; error?: string }>('admin/email/campaigns', input);
  }

  /** Edit a reminder campaign (partial). */
  updateEmailCampaign(id: string, input: Partial<EmailCampaignInput>): Promise<{ ok: boolean; campaign?: EmailCampaign; error?: string }> {
    return this.api.patch<{ ok: boolean; campaign?: EmailCampaign; error?: string }>(`admin/email/campaigns/${id}`, input);
  }

  /** Delete a reminder campaign and its send ledger. */
  deleteEmailCampaign(id: string): Promise<{ ok: boolean; error?: string }> {
    return this.api.delete<{ ok: boolean; error?: string }>(`admin/email/campaigns/${id}`);
  }

  /** Send this period's reminder immediately (still once-per-period). */
  runEmailCampaign(id: string): Promise<EmailCampaignRunResult> {
    return this.api.post<EmailCampaignRunResult>(`admin/email/campaigns/${id}/run`, {});
  }

  /**
   * One reminder as a portable template file (words + the email design).
   *
   * The server also sets a Content-Disposition filename; the console ignores it
   * and names the download itself, because the same bundle is shown in-page.
   */
  exportEmailCampaign(id: string): Promise<unknown> {
    return this.api.get<unknown>(`admin/email/campaigns/${id}/export`);
  }

  /**
   * Turn an uploaded template file back into a reminder.
   *
   * Answers 200 with `{ ok: false, error }` when the file is refused — the
   * version gate's message is written for a person, so the console shows it
   * rather than inventing its own.
   */
  importEmailTemplate(
    bundle: unknown,
    applyBranding = false,
  ): Promise<{ ok: boolean; error?: string; replaced?: boolean; brandingApplied?: boolean; campaign?: EmailCampaign }> {
    return this.api.post<{ ok: boolean; error?: string; replaced?: boolean; brandingApplied?: boolean; campaign?: EmailCampaign }>(
      'admin/email/campaigns/import',
      { bundle, applyBranding },
    );
  }

  /** Recent send-ledger rows for a campaign. */
  emailCampaignSends(id: string): Promise<Array<{ email: string; periodKey: string; status: string; error: string | null; createdAt: string }>> {
    return this.api.get<Array<{ email: string; periodKey: string; status: string; error: string | null; createdAt: string }>>(
      `admin/email/campaigns/${id}/sends`,
    );
  }

  /**
   * One page of the send history — every message this system sent, newest
   * first, across reminders, one-off sends and broadcasts.
   *
   * Paged by cursor rather than page number: the log only grows at its head, so
   * a page number would skip or repeat rows as new sends land mid-read.
   */
  emailHistory(query: EmailHistoryQuery = {}): Promise<EmailHistoryPage> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.kind) params.set('kind', query.kind);
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return this.api.get<EmailHistoryPage>(`admin/email/history${qs ? `?${qs}` : ''}`);
  }

  /**
   * The approval queue: messages agents have drafted through MCP and nobody has
   * decided on yet. Nothing here has been sent — `approveQueuedEmail` is the
   * only thing that delivers one.
   */
  emailOutbox(query: { status?: EmailOutboxStatus; limit?: number } = {}): Promise<EmailOutboxPage> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return this.api.get<EmailOutboxPage>(`admin/email/outbox${qs ? `?${qs}` : ''}`);
  }

  /** Approve a queued message — this SENDS it. */
  approveQueuedEmail(id: string, note?: string): Promise<EmailOutboxReview> {
    return this.api.post<EmailOutboxReview>(`admin/email/outbox/${encodeURIComponent(id)}/approve`, {
      ...(note ? { note } : {}),
    });
  }

  /** Reject a queued message — nothing is sent. */
  rejectQueuedEmail(id: string, note?: string): Promise<EmailOutboxReview> {
    return this.api.post<EmailOutboxReview>(`admin/email/outbox/${encodeURIComponent(id)}/reject`, {
      ...(note ? { note } : {}),
    });
  }

  /** Remove an address from the suppression list. */
  removeEmailSuppression(email: string): Promise<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`admin/email/suppressions/${encodeURIComponent(email)}`);
  }

  /** Enqueue a re-embedding job for a learning module. */
  reingestModule(id: string): Promise<{ accepted: boolean; moduleKey: string }> {
    return this.api.post<{ accepted: boolean; moduleKey: string }>(
      `admin/modules/${id}/reingest`,
      {},
    );
  }

  /** Get a presigned download URL for any document (admin scope). */
  getDocumentUrl(id: string): Promise<{ signedUrl: string; fileName: string }> {
    return this.api.get<{ signedUrl: string; fileName: string }>(`admin/documents/${id}/url`);
  }

  // ----- analytics -----

  getAnalyticsSummary(): Promise<{
    totalFirms: number;
    firmsWithDocumentsPct: number;
    firmsWithDiagnosticPct: number;
    firmsWithIntakePct: number;
    avgModulesCompleted: number;
    firmsActiveLast14DaysPct: number;
    firmsReturnedPct: number;
    keywordsComingSoon: boolean;
  }> {
    return this.api.get('admin/analytics/summary');
  }

  getAnalyticsFirms(filters?: {
    missingDocs?: boolean;
    inactiveDays?: number;
    moduleCompletion?: number;
  }): Promise<Array<{
    firmId: string;
    firmName: string;
    documentCount: number;
    messageCount: number;
    hasDiagnostic: boolean;
    intakeComplete: boolean;
    createdAt: string;
    processedDocumentCount: number;
    lastMessageAt: string | null;
    modulesCompleted: number;
  }>> {
    return this.api.get('admin/analytics/firms', {
      params: {
        missingDocs: filters?.missingDocs,
        inactiveDays: filters?.inactiveDays,
        moduleCompletion: filters?.moduleCompletion,
      },
    });
  }

  analyticsExportUrl(anonymized: boolean): string {
    return this.api.url(`admin/analytics/export?anonymized=${anonymized}`);
  }

  /**
   * Real (persisted) per-user & per-firm LLM token + monetary-cost usage totals,
   * grouped from the `LlmUsage` table. `sort` orders both lists by the given key.
   */
  getAnalyticsUsage(
    sort: 'costUsd' | 'tokensUsed' | 'requestCount' = 'costUsd',
    firmId?: string,
  ): Promise<{
    perUser: Array<{ userId: string; tokensUsed: number; costUsd: number; requestCount: number }>;
    perFirm: Array<{ firmId: string; tokensUsed: number; costUsd: number; requestCount: number }>;
    sort: string;
    firmId: string | null;
  }> {
    return this.api.get('admin/analytics/stats', {
      params: { sort, firmId: firmId || undefined },
    });
  }

  /**
   * Per-user LLM token intensity — how many tokens each user has consumed with
   * their requests to the tool, plus the estimated USD cost.
   */
  getTokenUsage(): Promise<{
    perUser: Array<{
      userId: string;
      email: string | null;
      name: string | null;
      userLabel: string;
      tokensUsed: number;
      costUsd: number;
      requestCount: number;
    }>;
    totalCostUsd: number;
    totalTokens: number;
    totalRequests: number;
  }> {
    return this.api.get('admin/tokens/stats');
  }

  /**
   * NOTE: the org-scoped consumption reader lives at the top of this class as
   * {@link getTokenConsumption} (typed via the `TokenConsumption` interface);
   * this section keeps only the legacy cap writer used by the connections tab.
   */

  /**
   * Set (or clear, by passing null) one organization's rolling token caps.
   * PATCH /api/admin/analytics/token-limits.
   */
  setFirmTokenLimits(
    firmId: string,
    maxTokens5h: number | null,
    maxTokensWeekly: number | null,
  ): Promise<{ ok: boolean; firmId: string; maxTokens5h: number | null; maxTokensWeekly: number | null }> {
    return this.api.patch('admin/analytics/token-limits', { firmId, maxTokens5h, maxTokensWeekly });
  }

  /**
   * Filter-object variant of {@link getAnalyticsUsage}, mirroring the
   * `getAnalyticsFirms(filters?)` shape. Returns the same real (persisted)
   * per-user & per-firm LLM token + monetary-cost totals from the `LlmUsage`
   * table, ordered by `filters.sort` (default `costUsd`) and optionally scoped
   * to a single firm via `filters.firmId`. These are LLM tokens/cost — a
   * separate concept from the registration/invite tokens.
   */
  getUsageIntensity(filters?: {
    sort?: 'costUsd' | 'tokensUsed' | 'requestCount';
    firmId?: string;
  }): Promise<{
    perUser: Array<{ userId: string; tokensUsed: number; costUsd: number; requestCount: number }>;
    perFirm: Array<{ firmId: string; tokensUsed: number; costUsd: number; requestCount: number }>;
    sort: string;
    firmId: string | null;
  }> {
    return this.api.get('admin/analytics/stats', {
      params: {
        sort: filters?.sort,
        firmId: filters?.firmId || undefined,
      },
    });
  }

  /**
   * URL of the per-user usage-intensity CSV export — fetch via window.location
   * or an anchor, mirroring `tokensExportUrl()` / `analyticsExportUrl()`. The
   * optional `sort`/`firmId` filters are carried through as query params so the
   * exported ordering/scope matches the on-screen list.
   */
  usageExportUrl(filters?: {
    sort?: 'costUsd' | 'tokensUsed' | 'requestCount';
    firmId?: string;
  }): string {
    const params = new URLSearchParams();
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.firmId) params.set('firmId', filters.firmId);
    const qs = params.toString();
    return this.api.url(`admin/analytics/stats/export.csv${qs ? `?${qs}` : ''}`);
  }

  // ----- conversation logs -----

  /** List persisted user conversations grouped per firm. */
  listConversations(): Promise<Array<{
    id: string;
    firmName: string;
    userName: string;
    agentType: 'documents' | 'curriculum';
    messageCount: number;
    lastMessage: string;
    timestamp: string;
    tokensUsed: number;
  }>> {
    return this.api.get('admin/conversations');
  }

  /** Fetch the full message transcript for one firm's conversation. */
  getConversationMessages(firmId: string): Promise<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>> {
    return this.api.get(`admin/conversations/${firmId}/messages`);
  }

  /** Admin research chat — queries curriculum RAG and/or web search. */
  adminResearch(
    query: string,
    mode: 'rag' | 'web' | 'both' = 'rag',
    agent: 'documents' | 'research' = 'documents',
  ): Promise<{
    content: string;
    sources: Array<{ title: string; excerpt: string; type: 'chunk' | 'web'; url?: string }>;
  }> {
    return this.api.post<{
      content: string;
      sources: Array<{ title: string; excerpt: string; type: 'chunk' | 'web'; url?: string }>;
    }>('admin/research', { query, mode, agent });
  }
}

/** Reminder-campaign cadence — the period the send ledger buckets by. */
export type EmailCampaignCadence = 'daily' | 'weekly' | 'monthly';

/** Who a reminder campaign goes to. */
export type EmailCampaignScope = 'incomplete-profile' | 'inactive' | 'all';

export interface EmailCampaignInput {
  name: string;
  subject: string;
  body: string;
  cadence: EmailCampaignCadence;
  targetScope: EmailCampaignScope;
  inactiveDays: number;
  active: boolean;
}

/** Which send path produced a message. */
export type EmailSendKind = 'reminder' | 'one-off' | 'broadcast';

export interface EmailHistoryQuery {
  limit?: number;
  /** Id of the last row of the previous page. */
  cursor?: string;
  kind?: EmailSendKind;
  /** Substring match on the recipient address. */
  search?: string;
}

export interface EmailHistoryRow {
  id: string;
  kind: EmailSendKind;
  email: string;
  subject: string | null;
  /** Set only for reminder rows; names the campaign that produced them. */
  campaignName: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface EmailHistoryPage {
  rows: EmailHistoryRow[];
  /** Null when this was the last page. */
  nextCursor: string | null;
}

export type EmailOutboxStatus = 'pending' | 'approved' | 'rejected';

/** One agent-drafted message awaiting, or past, a human decision. */
export interface EmailOutboxRow {
  id: string;
  firmId: string;
  /** Which agent drafted it — copied at queue time, so it outlives the token. */
  agent: string;
  tokenKeyId: string | null;
  to: string[];
  subject: string;
  body: string;
  status: EmailOutboxStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  sentCount: number;
  failedCount: number;
  error: string | null;
}

export interface EmailOutboxPage {
  items: EmailOutboxRow[];
  count: number;
}

export interface EmailOutboxReview {
  ok: boolean;
  id?: string;
  status?: EmailOutboxStatus;
  sent?: number;
  failed?: number;
  error?: string;
}

export interface EmailCampaign extends EmailCampaignInput {
  id: string;
  lastRunAt: string | null;
  createdAt: string;
}

export interface EmailCampaignRunResult {
  ok: boolean;
  periodKey: string;
  targets: number;
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
  error?: string;
}

/** One personalisation token an admin may put in a subject or message. */
export interface EmailMergeField {
  token: string;
  label: string;
  description: string;
  example: string;
  /** What a recipient missing this detail sees instead of a blank. */
  fallback: string;
  /** Worked out per firm at send time (weekly progress), not read from the profile. */
  computed?: boolean;
}

/** A file attached to a one-off send; `content` is base64. */
export interface EmailAttachmentInput {
  filename: string;
  content: string;
  contentType?: string;
}

/** Server-rendered draft — the same render the send path performs. */
export interface EmailPreview {
  ok: boolean;
  sample: string | null;
  subject: string;
  html: string;
  text: string;
  /** Tags the renderer cannot fill; these would be mailed out literally. */
  unknownTags: string[];
  error?: string;
}
