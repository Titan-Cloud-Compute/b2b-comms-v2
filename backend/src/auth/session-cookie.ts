import type { CookieOptions } from 'express';

/**
 * Single source of truth for the session cookie's name, lifetime, and
 * attributes. Shared by AuthController (login/signup/logout/refresh) and
 * SessionRenewInterceptor (sliding renewal) — the two MUST stay identical or
 * a renewed cookie would differ in path/flags from the login cookie and the
 * browser would keep both.
 */
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}
