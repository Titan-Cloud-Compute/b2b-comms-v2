import { PrismaService } from '../prisma/prisma.service';

const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Resolves a configuration value with this priority:
 *
 *   1. `process.env[key]` (set at deploy time via Helm/values).
 *   2. `SystemSetting` row keyed by `key` (set by an ADMIN via
 *      `PATCH /api/admin/settings`).
 *   3. `null` — the feature is unconfigured. Callers should throw a
 *      `ServiceUnconfiguredError` so the GlobalExceptionFilter can map it
 *      to a 503 with the right `service` identifier.
 *
 * The well-known placeholder string `PLACEHOLDER_CONFIGURE_IN_SETTINGS` is
 * treated as "unset" — this lets us ship Helm values with placeholders so
 * the deployment boots before an admin has filled in the integration
 * credentials.
 */
export async function resolveConfig(
  prisma: PrismaService,
  key: string,
): Promise<string | null> {
  const envVal = process.env[key];
  if (envVal && envVal !== PLACEHOLDER) return envVal;

  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (setting?.value && setting.value !== PLACEHOLDER) return setting.value;

  return null;
}

/** Returns true if the resolved value is missing or the placeholder. */
export function isUnconfigured(value: string | null | undefined): boolean {
  return !value || value === PLACEHOLDER;
}

export { PLACEHOLDER };
