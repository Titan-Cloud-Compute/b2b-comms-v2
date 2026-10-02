import {
  Body,
  Controller,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
  Optional,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireAdmin } from '../auth/roles.guard';
import { Audit } from '../common/audit.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { CONFIG_PLACEHOLDER } from '../common/errors';
import { KNOWN_KEYS, isDisplaySafeKey } from './admin-settings.constants';
import { maskValue, isMaskEcho } from './admin-settings.masking';
import { AdminSettingsService } from './admin-settings.service';
import { AuditLogService } from '../common/audit-log.service';

/**
 * Admin runtime configuration. Lists service-credential keys and lets ADMINs
 * upsert them. Values are *masked* on read (showing only last 4 chars) so the
 * Swagger explorer doesn't leak production secrets.
 *
 * Values are returned alongside `source` ('env' | 'db' | null) and
 * `configured` (boolean) so the frontend can render a lock icon on env-sourced
 * keys (which require a redeploy to change).
 */
@ApiTags('admin-settings')
@UseGuards(JwtAuthGuard)
@RequireAdmin()
@Controller('api/admin/settings')
export class AdminSettingsController {
  private readonly logger = new Logger(AdminSettingsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @Optional() private readonly adminSettingsService?: AdminSettingsService,
    @Optional() private readonly auditLogService?: AuditLogService,
    @Optional() private readonly _reserved?: unknown,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.runAsAdmin((tx) =>
      tx.systemSetting.findMany(),
    );
    const dbMap = new Map(rows.map((r) => [r.key, r]));
    const allKeys = new Set<string>([...KNOWN_KEYS, ...dbMap.keys()]);

    // The platform binds Postgres/Redis as composite connection URLs
    // (DATABASE_URL, REDIS_URL) and MinIO under the S3_* alias rather than as
    // the individual PG_USER / MINIO_ACCESS_KEY / … keys the admin form edits.
    // Derive those component values so the form reflects what is actually in
    // use instead of leaving the inputs blank.
    const derived = deriveCompositeCredentials();

    return Array.from(allKeys)
      .sort()
      .map((key) => {
        const envVal = process.env[key];
        const dbRow = dbMap.get(key);
        const derivedVal = derived[key];
        const envGood = !!envVal && envVal !== CONFIG_PLACEHOLDER;
        const dbGood = !!dbRow?.value && dbRow.value !== CONFIG_PLACEHOLDER;
        const derivedGood = !!derivedVal && derivedVal !== CONFIG_PLACEHOLDER;
        const value = envGood
          ? envVal!
          : dbGood
            ? dbRow!.value
            : derivedGood
              ? derivedVal!
              : null;
        const source: 'env' | 'db' | null = envGood
          ? 'env'
          : dbGood
            ? 'db'
            : derivedGood
              ? 'env'
              : null;
        // Credentials are masked; plain configuration (host, port, mailbox
        // address, public URL) is returned in full so a form can reload the
        // value the admin actually saved. `secret` tells the client which it
        // got, so it never patches a mask back over a real value.
        const secret = !isDisplaySafeKey(key);
        return {
          key,
          configured: !!value,
          maskedValue: value ? (secret ? maskValue(value) : value) : null,
          secret,
          source,
          updatedAt: dbRow?.updatedAt ?? null,
        };
      });
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @Audit('settings.update')
  async patch(@Body() body: unknown) {
    const PatchSchema = z.array(
      z.object({
        key: z.string().min(1).max(128),
        value: z.string().max(8192),
      }),
    );
    const items = PatchSchema.parse(body ?? []);
    if (items.length === 0) return { ok: true, updated: 0, skipped: 0 };

    // Refuse to persist a masked preview. Every admin form is supposed to drop
    // an untouched field before saving, but that check is hand-rolled in each
    // one; when a form forgets, the write lands as bullets over a real
    // credential and only shows up later as a service that stops
    // authenticating. Enforce it once, here, where nothing can route around it.
    const written = await this.prisma.runAsAdmin(async (tx) => {
      const stored = await tx.systemSetting.findMany({
        where: { key: { in: items.map((i) => i.key) } },
        select: { key: true, value: true },
      });
      const storedByKey = new Map(stored.map((r) => [r.key, r.value]));
      const real = items.filter(({ key, value }) => !isMaskEcho(value, storedByKey.get(key)));
      await Promise.all(
        real.map(({ key, value }) =>
          tx.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          }),
        ),
      );
      return real;
    });

    const skipped = items.length - written.length;
    if (skipped > 0) {
      // Loud on purpose: a skip means a client sent back what it was shown, so
      // the stored value survived but that form has a bug worth finding.
      this.logger.warn(
        `settings.update ignored ${skipped} masked echo(es): ` +
          items
            .filter((i) => !written.includes(i))
            .map((i) => i.key)
            .join(', '),
      );
    }
    // Drop the in-memory cache so subsequent reads see the new values.
    for (const { key } of written) this.config.invalidate(key);
    return { ok: true, updated: written.length, skipped };
  }

  // ── private test helpers ────────────────────────────────────────────────────

  private async testPostgres(elapsed: () => number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: elapsed() };
    } catch (err) {
      return { ok: false, latencyMs: elapsed(), error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testLitellm(elapsed: () => number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const baseUrl = await this.config.resolveConfig('LITELLM_BASE_URL');
    const apiKey = await this.config.resolveConfig('LITELLM_API_KEY');
    if (!baseUrl || !apiKey) {
      return { ok: false, latencyMs: elapsed(), error: 'LITELLM_BASE_URL and LITELLM_API_KEY must be configured' };
    }
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, latencyMs: elapsed(), error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, latencyMs: elapsed() };
    } catch (err) {
      return { ok: false, latencyMs: elapsed(), error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testEmbedding(elapsed: () => number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const baseUrl =
      (await this.config.resolveConfig('EMBEDDING_BASE_URL')) ||
      (await this.config.resolveConfig('LITELLM_BASE_URL'));
    const apiKey =
      (await this.config.resolveConfig('EMBEDDING_API_KEY')) ||
      (await this.config.resolveConfig('LITELLM_API_KEY'));
    const model = await this.config.resolveConfig('OPENAI_EMBED_MODEL');
    if (!baseUrl || !model) {
      return {
        ok: false,
        latencyMs: elapsed(),
        error: 'EMBEDDING_BASE_URL and OPENAI_EMBED_MODEL must be configured',
      };
    }
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ input: ['health'], model }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, latencyMs: elapsed(), error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, latencyMs: elapsed() };
    } catch (err) {
      return { ok: false, latencyMs: elapsed(), error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Reconstruct the individual credential keys that the admin form edits from the
 * composite connection strings / aliases the platform actually injects:
 *   - Postgres → parsed out of DATABASE_URL (user, password, host, port, db)
 *   - Redis    → parsed out of REDIS_URL (password, host, port)
 *   - MinIO    → taken from the S3_* alias env vars (endpoint, access/secret key)
 *
 * Only env-derived values are returned (never DB rows) so an explicit
 * /api/admin/settings override of a specific key still takes precedence in
 * list(). Malformed URLs are ignored rather than thrown.
 */
function deriveCompositeCredentials(): Record<string, string> {
  const out: Record<string, string> = {};
  const fromEnv = (k: string): string | undefined => {
    const v = process.env[k];
    return v && v !== CONFIG_PLACEHOLDER ? v : undefined;
  };
  const setIf = (key: string, value: string | undefined | null): void => {
    if (value) out[key] = value;
  };

  // MinIO is bound under the S3_* alias by the platform service binding.
  setIf('MINIO_ENDPOINT', fromEnv('S3_ENDPOINT'));
  setIf('MINIO_ACCESS_KEY', fromEnv('S3_ACCESS_KEY'));
  setIf('MINIO_SECRET_KEY', fromEnv('S3_SECRET_KEY'));

  // Postgres credentials are embedded in the composite DATABASE_URL.
  const dbUrl = fromEnv('DATABASE_URL');
  if (dbUrl) {
    try {
      const u = new URL(dbUrl);
      setIf('PG_USER', u.username ? decodeURIComponent(u.username) : undefined);
      setIf('PG_PASSWORD', u.password ? decodeURIComponent(u.password) : undefined);
      setIf('PG_HOST', u.hostname || undefined);
      setIf('PG_PORT', u.port || undefined);
      const db = u.pathname.replace(/^\//, '');
      setIf('PG_DATABASE', db || undefined);
    } catch {
      /* malformed DATABASE_URL — leave PG_* underived */
    }
  }

  // Redis password (and host/port) are embedded in the composite REDIS_URL.
  const redisUrl = fromEnv('REDIS_URL');
  if (redisUrl) {
    try {
      const u = new URL(redisUrl);
      setIf('REDIS_PASSWORD', u.password ? decodeURIComponent(u.password) : undefined);
      setIf('REDIS_HOST', u.hostname || undefined);
      setIf('REDIS_PORT', u.port || undefined);
    } catch {
      /* malformed REDIS_URL — leave REDIS_* underived */
    }
  }

  return out;
}
