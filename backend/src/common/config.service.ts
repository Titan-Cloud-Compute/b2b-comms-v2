import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Two-layer config resolver.
 *
 * Priority order:
 *   1. process.env[key]  (set at deploy time via app-secrets)
 *   2. SystemSetting DB row (set via admin settings panel at runtime)
 *
 * Returns null when neither is set OR when the resolved value is the
 * sentinel placeholder. Callers MUST treat null as "feature unconfigured"
 * and (typically) throw ServiceUnconfiguredError so the global exception
 * filter turns it into a 503.
 *
 * SystemSetting reads bypass the firm-scope RLS GUC because the table has
 * no firmId column and RLS is disabled on it. The query runs in whatever
 * transaction the caller is in, which is intentional — bootstrap code may
 * resolve config before any firm context exists.
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveConfig(key: string): Promise<string | null> {
    const envVal = process.env[key];
    if (envVal && envVal !== PLACEHOLDER) return envVal;

    const row = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (row?.value && row.value !== PLACEHOLDER) return row.value;

    return null;
  }

  /** Convenience for callers that need many keys in one round-trip. */
  async resolveMany(keys: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    const envHits: string[] = [];
    for (const k of keys) {
      const v = process.env[k];
      if (v && v !== PLACEHOLDER) {
        out[k] = v;
        envHits.push(k);
      }
    }
    const remaining = keys.filter((k) => !envHits.includes(k));
    if (remaining.length > 0) {
      const rows = await this.prisma.systemSetting.findMany({
        where: { key: { in: remaining } },
      });
      const map = new Map(rows.map((r) => [r.key, r.value]));
      for (const k of remaining) {
        const v = map.get(k);
        out[k] = v && v !== PLACEHOLDER ? v : null;
      }
    }
    return out;
  }

  isPlaceholder(value: string | null | undefined): boolean {
    return !value || value === PLACEHOLDER;
  }
}
