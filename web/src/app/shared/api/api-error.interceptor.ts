import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';
import { AuthService } from '../auth.service';
import { SKIP_AUTH_REDIRECT } from './api-client.service';

/**
 * Global HTTP interceptor for cross-cutting auth/availability concerns.
 *
 *   - 401 → push '/login' (the session expired or never existed)
 *   - 403 → toast the message (forbidden — typically rctArm leak block
 *           or wb_admin-only routes hit by a firm user)
 *   - 503 → toast with a retry CTA (an integration is unconfigured or
 *           down; the user can retry once the operator fixes it)
 *
 * Other statuses are NOT toasted globally — call sites surface
 * domain-specific errors inline (eg. login form error, signup form
 * error). The interceptor re-throws every error so the per-call
 * handlers still run.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  // Only act on our own API; never interfere with third-party hosts.
  const isApi =
    req.url.startsWith('/api/') ||
    req.url.startsWith('/trpc/') ||
    req.url.startsWith('api/');
  if (!isApi) return next(req);

  const router = inject(Router);
  const toast = inject(ToastService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        switch (err.status) {
          case 401: {
            // Avoid bouncing if we're already on /login or trying to
            // call /api/auth/login itself (which legitimately 401s on
            // bad credentials).
            const isAuthCall =
              req.url.includes('/auth/login') ||
              req.url.includes('/auth/signup') ||
              req.url.includes('/auth/logout');
            // Explicit per-call opt-out (SKIP_AUTH_REDIRECT): used by session
            // HANDOFF requests such as the intake-finish pipeline. A transient
            // 401 there must not clear the cached identity and hijack the
            // in-flight navigation into the sign-in screen — the caller
            // recovers (refresh/retry) and still owns where the user lands.
            const skipRedirect = req.context.get(SKIP_AUTH_REDIRECT);
            if (skipRedirect) break;
            // Server-authoritative session invalidation: a 401 from our own
            // API means the SESSION IS DEAD (the backend reserves 401 for a
            // missing/expired session cookie; authenticated-but-not-allowed
            // endpoints return 403). The cached client-side auth flag is NOT
            // consulted — it lives in localStorage and outlives the cookie,
            // which used to strand users on "not authenticated" error pages
            // instead of taking them back through the login flow.
            if (!isAuthCall && !router.url.startsWith('/login')) {
              auth.setUser(null); // drop the stale cached identity
              // Carry the interrupted destination so login can return the
              // user there instead of the role default (standard returnUrl
              // round-trip; login validates it as an internal path).
              const returnUrl = router.url;
              void router.navigate(
                ['/login'],
                returnUrl && returnUrl !== '/' ? { queryParams: { returnUrl } } : {},
              );
            }
            break;
          }
          case 403:
            toast.show(
              extractMessage(err) ?? 'You do not have permission to do that.',
              'error',
            );
            break;
          case 503:
            toast.show(
              extractMessage(err) ??
                'A backend service is unavailable. Please retry shortly.',
              'warning',
              { retry: true },
            );
            break;
        }
      }
      return throwError(() => err);
    }),
  );
};

function extractMessage(err: HttpErrorResponse): string | null {
  const body = err.error;
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b['message'] === 'string') return b['message'] as string;
  if (Array.isArray(b['message']) && typeof b['message'][0] === 'string') {
    return (b['message'] as string[]).join('; ');
  }
  return null;
}
