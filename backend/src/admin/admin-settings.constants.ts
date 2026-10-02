/**
 * Single source of truth for the known infrastructure/integration setting keys
 * exposed through /api/admin/settings.
 *
 * The list is intentionally narrow — arbitrary process.env keys (PATH,
 * NODE_ENV, …) must not be surfaced through the admin API.
 */
export const KNOWN_KEYS = [
  // Postgres
  'DATABASE_URL',
  'PG_HOST',
  'PG_PORT',
  'PG_USER',
  'PG_PASSWORD',
  'PG_DATABASE',
  // Redis
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  // MinIO / S3
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  // LiteLLM / OpenAI
  'LITELLM_BASE_URL',
  'LITELLM_API_KEY',
  'OPENAI_API_BASE',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_EMBED_MODEL',
  // Anthropic
  'ANTHROPIC_API_KEY',
  // GLM
  'GLM_BASE_URL',
  'GLM_API_KEY',
  'GLM_MODEL',
  // BGGPT
  'BGGPT_BASE_URL',
  'BGGPT_API_KEY',
  // Twilio
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_WEBHOOK_URL',
  // Email / SMTP
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
  // Public base URL for links in outbound email (unsubscribe, etc.)
  'APP_PUBLIC_URL',
  // Auth
  'JWT_SECRET',
  // App
  'GDPR_CONSENT_TEXT',
  'WEB_SEARCH_API_KEY',
  'TRANSLATION_PIPELINE_ENABLED',
] as const;

export type KnownKey = (typeof KNOWN_KEYS)[number];

/**
 * Keys whose value is CONFIGURATION, not a credential, and is therefore
 * returned to the admin UI in full.
 *
 * Deny-by-default on purpose: anything absent from this list — including a key
 * added to KNOWN_KEYS later, or an arbitrary row someone writes into
 * SystemSetting — is still masked. Adding a key here is a deliberate act.
 *
 * Why this exists: the settings API used to mask EVERY value, so the SMTP form
 * reloaded with empty Host/Port/From boxes even when they were configured, and
 * pressing Save then wrote those blanks over the stored values.
 */
export const DISPLAY_SAFE_KEYS: readonly string[] = [
  // Postgres / Redis — endpoints and names, never the password
  'PG_HOST',
  'PG_PORT',
  'PG_USER',
  'PG_DATABASE',
  'REDIS_HOST',
  'REDIS_PORT',
  // Object storage endpoints and bucket names (keys stay masked)
  'MINIO_ENDPOINT',
  'MINIO_BUCKET',
  'S3_ENDPOINT',
  'S3_BUCKET',
  // Model endpoints and model names (API keys stay masked)
  'LITELLM_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_MODEL',
  'OPENAI_EMBED_MODEL',
  'GLM_BASE_URL',
  'GLM_MODEL',
  'BGGPT_BASE_URL',
  // Twilio addresses (account SID and auth token stay masked)
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_WEBHOOK_URL',
  // SMTP: everything except the password. The username is a mailbox address,
  // which the admin must be able to read to know which account is sending.
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'EMAIL_FROM',
  'APP_PUBLIC_URL',
  // App-level text and flags
  'GDPR_CONSENT_TEXT',
  'TRANSLATION_PIPELINE_ENABLED',
];

/** True when a key's value may be shown to an admin in full. */
export function isDisplaySafeKey(key: string): boolean {
  return DISPLAY_SAFE_KEYS.includes(key);
}
