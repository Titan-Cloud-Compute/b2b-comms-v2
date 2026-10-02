import { Injectable } from '@nestjs/common';
import { PLACEHOLDER } from '../common/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { KNOWN_KEYS } from './admin-settings.constants';

const SECRET_KEY_RE = /(_KEY|_TOKEN|_SECRET|PASSWORD|URL)$/;

export interface AdminSettingView {
  key: string;
  configured: boolean;
  /** Masked when the key looks like a secret. */
  value: string | null;
  source: 'env' | 'db' | null;
  updatedAt: Date | null;
}

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminSettingView[]> {
    const dbRows = await this.prisma.runAsAdmin((tx) =>
      tx.systemSetting.findMany(),
    );
    const dbMap = new Map(dbRows.map((r) => [r.key, r]));

    const allKeys = new Set<string>([
      ...KNOWN_KEYS,
      ...dbRows.map((r) => r.key),
    ]);

    const out: AdminSettingView[] = [];
    for (const key of [...allKeys].sort()) {
      const envVal = process.env[key];
      const dbRow = dbMap.get(key);
      const envGood = !!envVal && envVal !== PLACEHOLDER;
      const dbGood = !!dbRow?.value && dbRow.value !== PLACEHOLDER;
      const rawValue = envGood ? envVal! : dbGood ? dbRow!.value : null;
      const source = envGood ? 'env' : dbGood ? 'db' : null;
      out.push({
        key,
        configured: !!rawValue,
        value: rawValue == null ? null : maskIfSecret(key, rawValue),
        source: source as AdminSettingView['source'],
        updatedAt: dbRow?.updatedAt ?? null,
      });
    }
    return out;
  }

  async upsertMany(
    pairs: Array<{ key: string; value: string }>,
  ): Promise<{ ok: true }> {
    await this.prisma.runAsAdmin(async (tx) => {
      await Promise.all(
        pairs.map((p) =>
          tx.systemSetting.upsert({
            where: { key: p.key },
            update: { value: p.value },
            create: { key: p.key, value: p.value },
          }),
        ),
      );
    });
    return { ok: true as const };
  }
}

/**
 * Mask anything that looks like a secret. We keep the first 4 + last 4
 * characters for diagnosability; never return the full value over the
 * admin API even to a logged-in admin.
 */
function maskIfSecret(key: string, value: string): string {
  if (!SECRET_KEY_RE.test(key)) return value;
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
