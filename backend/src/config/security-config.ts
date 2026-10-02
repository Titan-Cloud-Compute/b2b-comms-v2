/**
 * Boot-time security-configuration guard.
 *
 * The app signs session JWTs with `process.env.JWT_SECRET`, falling back to a
 * built-in development sentinel when the env var is unset. That fallback is
 * committed to this repo, so a production deploy that forgets to set
 * JWT_SECRET would sign every session with a publicly-known secret — any
 * attacker could then forge an admin session. This module refuses to boot in
 * that state.
 */

/**
 * The built-in development JWT secret. Shared by auth.module and mcp.module so
 * the value exists in exactly one place and the boot guard can detect it.
 */
export const DEV_JWT_SECRET_SENTINEL =
  'dev-only-do-not-use-in-prod-change-via-secrets';

/**
 * Throw when the runtime is production but JWT_SECRET is unset or still the
 * built-in dev sentinel; a no-op in non-production. Pure: reads only the passed
 * env object so it is unit-testable without mutating process.env.
 */
export function assertSecuritySafe(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const isProduction = env.NODE_ENV === 'production';
  if (!isProduction) {
    return;
  }
  const secret = env.JWT_SECRET;
  if (!secret || secret === DEV_JWT_SECRET_SENTINEL) {
    throw new Error(
      'FATAL: JWT_SECRET must be set to a non-default value in production ' +
        '(refusing the built-in dev secret).',
    );
  }
}
