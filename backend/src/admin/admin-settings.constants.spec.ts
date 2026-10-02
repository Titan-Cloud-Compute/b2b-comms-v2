import { KNOWN_KEYS, DISPLAY_SAFE_KEYS, isDisplaySafeKey } from './admin-settings.constants';

/**
 * The allowlist decides what the admin API shows in full. A mistake here leaks
 * a credential, so the classification is pinned by tests rather than by review.
 */
describe('isDisplaySafeKey', () => {
  it('shows SMTP configuration so the form can reload it', () => {
    for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'EMAIL_FROM', 'APP_PUBLIC_URL']) {
      expect(isDisplaySafeKey(key)).toBe(true);
    }
  });

  it('never shows a password, token, key or connection string', () => {
    for (const key of [
      'SMTP_PASSWORD',
      'PG_PASSWORD',
      'REDIS_PASSWORD',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'LITELLM_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GLM_API_KEY',
      'BGGPT_API_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'WEB_SEARCH_API_KEY',
    ]) {
      expect(isDisplaySafeKey(key)).toBe(false);
    }
  });

  it('fails closed for a key nobody classified', () => {
    expect(isDisplaySafeKey('SOME_FUTURE_PROVIDER_SECRET')).toBe(false);
    expect(isDisplaySafeKey('')).toBe(false);
  });

  it('lists only keys that exist, so a rename cannot leave a dead entry', () => {
    const known = new Set<string>(KNOWN_KEYS);
    expect(DISPLAY_SAFE_KEYS.filter((k) => !known.has(k))).toEqual([]);
  });
});
