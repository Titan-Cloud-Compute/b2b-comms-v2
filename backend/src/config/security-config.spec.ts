import {
  assertSecuritySafe,
  DEV_JWT_SECRET_SENTINEL,
} from './security-config';

/**
 * Fail-to-pass guard: before assertSecuritySafe existed, a production deploy
 * with an unset or default JWT_SECRET booted silently. These cases pin the
 * refusal so that regression re-opens as a red test, not a live vulnerability.
 */
describe('assertSecuritySafe', () => {
  it('(a) production + JWT_SECRET undefined -> throws mentioning JWT_SECRET', () => {
    expect(() => assertSecuritySafe({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('(b) production + JWT_SECRET === dev sentinel -> throws', () => {
    expect(() =>
      assertSecuritySafe({
        NODE_ENV: 'production',
        JWT_SECRET: DEV_JWT_SECRET_SENTINEL,
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('(c) production + a real strong secret -> does not throw', () => {
    expect(() =>
      assertSecuritySafe({
        NODE_ENV: 'production',
        JWT_SECRET: 'a-real-strong-secret-value-not-the-default',
      }),
    ).not.toThrow();
  });

  it('(d) development + JWT_SECRET undefined -> does not throw', () => {
    expect(() =>
      assertSecuritySafe({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });
});
