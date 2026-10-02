import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG_PLACEHOLDER } from '../common/errors';

/**
 * Two-layer config resolution:
 *   1. process.env[key]  (set at deploy time from app-secrets)
 *   2. SystemSetting row (set via /api/admin/settings — overrides DB-defaults)
 *
 * If either layer holds CONFIG_PLACEHOLDER, that layer is treated as unset.
 * Returns null when the key is unconfigured — callers should throw
 * ServiceUnconfiguredError, which the global filter maps to HTTP 503.
 *
 * Reads are cached in-memory for 30s to avoid hammering Postgres on every
 * integration call; the cache is invalidated explicitly on PATCH /settings.
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger('AppConfigService');
  private cache = new Map<string, { value: string | null; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 30_000;

  /** Default values for non-secret service URLs */
  private static readonly DEFAULTS: Record<string, string> = {};

  constructor(private readonly prisma: PrismaService) {}

  async resolveConfig(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const envVal = process.env[key];
    if (envVal && envVal !== CONFIG_PLACEHOLDER) {
      this.cache.set(key, { value: envVal, expiresAt: Date.now() + AppConfigService.CACHE_TTL_MS });
      return envVal;
    }

    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      const value =
        row?.value && row.value !== CONFIG_PLACEHOLDER ? row.value : null;

      // Fall back to default if configured
      const finalValue = value ?? AppConfigService.DEFAULTS[key] ?? null;
      this.cache.set(key, { value: finalValue, expiresAt: Date.now() + AppConfigService.CACHE_TTL_MS });
      return finalValue;
    } catch (err) {
      this.logger.warn(
        `resolveConfig(${key}) DB lookup failed; falling back to env or default: ${err instanceof Error ? err.message : err}`,
      );
      const fallback = envVal && envVal !== CONFIG_PLACEHOLDER ? envVal : AppConfigService.DEFAULTS[key] ?? null;
      return fallback;
    }
  }

  /** Used by PATCH /api/admin/settings to drop cached entries. */
  invalidate(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  /** Convenience helper for code that knows the value is required. */
  async requireConfig(key: string, service: string): Promise<string> {
    const { ServiceUnconfiguredError } = await import('../common/errors');
    const v = await this.resolveConfig(key);
    if (!v) throw new ServiceUnconfiguredError(service, `${service} requires ${key}`);
    return v;
  }
}
