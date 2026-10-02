import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Observable, firstValueFrom, catchError, throwError } from 'rxjs';
import { mapHttpError } from './api-errors';
import { PREVIEW_MODE } from '../preview/preview-mode';
import { previewRespond } from '../preview/preview-api';

/**
 * Per-request opt-out of the global 401 → '/login' bounce performed by
 * `apiErrorInterceptor`. Set on calls that are part of a session HANDOFF
 * (eg. the intake-finish pipeline) where a transient 401 must not hijack an
 * in-flight navigation and strand the user on the sign-in screen. The error
 * still propagates to the caller — only the redirect is suppressed.
 */
export const SKIP_AUTH_REDIRECT = new HttpContextToken<boolean>(() => false);

export interface RequestOpts {
  /** Query params (string/number/bool). null/undefined values are skipped. */
  params?: Record<string, string | number | boolean | null | undefined>;
  /**
   * If true, do NOT auto-map errors — pass the HttpErrorResponse through so
   * the caller can inspect the raw status (used by the interceptor itself
   * if it ever wraps this).
   */
  raw?: boolean;
  /**
   * If true, a 401 on this request does NOT trigger the global redirect to
   * '/login' (see SKIP_AUTH_REDIRECT). The rejection still reaches the caller.
   */
  skipAuthRedirect?: boolean;
}

/**
 * Typed wrapper around HttpClient that:
 *
 *   - Sends cookies on every request (`withCredentials: true`) so the
 *     JWT session cookie set by the NestJS auth controller flows back.
 *   - Returns native Promises (callers normally `await` these from
 *     `signal`-driven services rather than wiring them up as
 *     observable streams).
 *   - Maps HTTP status codes to typed error classes (UnauthorizedError,
 *     ForbiddenError, ConflictError, ServiceUnavailableError, ...).
 *
 * Routes are passed as the path under `/api` (eg. `'auth/login'`). The
 * client prefixes `/api/` so callers don't have to remember.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private http = inject(HttpClient);

  /**
   * Relative base — no leading slash so the browser resolves it against the
   * document's base href (e.g. /my-app-staging/ in staging). This makes
   * API calls work correctly regardless of the URL prefix used by the nginx
   * ingress. In dev the Angular proxy forwards api/ to localhost:3000.
   */
  private readonly base = 'api';

  /**
   * In-flight de-duplication for idempotent POSTs (translation endpoints).
   * A language toggle can fire the same translate request from several
   * places at once; sharing one promise avoids N identical round-trips.
   * Entries are keyed by url+body+params and removed on failure so a retry
   * re-fetches. Typed as `Promise<unknown>` — reads cast back to `Promise<T>`.
   */
  private readonly postMemo = new Map<string, Promise<unknown>>();

  /**
   * Stable memo key for a POST, or `null` when the call must NOT be
   * de-duplicated. Only translation endpoints (`.../translate`,
   * `.../translate-message`, `i18n/...`) are memoizable — every other POST
   * is potentially non-idempotent and always hits the network.
   */
  private memoKey(path: string, body: unknown, opts: RequestOpts): string | null {
    const normalized = path.replace(/^\/+/, '').replace(/^api\/?/, '');
    const memoizable =
      normalized.startsWith('i18n/') ||
      normalized === 'i18n' ||
      /(^|\/)translate(-[a-z]+)?$/.test(normalized);
    if (!memoizable) return null;
    try {
      return `${this.url(path)}|${JSON.stringify(body ?? {})}|${JSON.stringify(opts.params ?? {})}`;
    } catch {
      // Non-serializable body (circular ref, FormData, ...) — don't memoize.
      return null;
    }
  }

  get<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    if (PREVIEW_MODE) return previewRespond<T>('GET', path);
    return this.send<T>(
      this.http.get<T>(this.url(path), {
        params: this.toParams(opts.params),
        context: this.toContext(opts),
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
  }

  /** Binary GET (file downloads) — same base/credentials conventions as get(). */
  getBlob(path: string): Promise<Blob> {
    return this.send<Blob>(
      this.http.get(this.url(path), { withCredentials: true, observe: 'body', responseType: 'blob' }),
      this.url(path),
    );
  }

  post<T>(path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
    if (PREVIEW_MODE) return previewRespond<T>('POST', path);
    const memoKey = this.memoKey(path, body, opts);
    if (memoKey) {
      const hit = this.postMemo.get(memoKey) as Promise<T> | undefined;
      if (hit) return hit;
    }
    const req = this.send<T>(
      this.http.post<T>(this.url(path), body ?? {}, {
        params: this.toParams(opts.params),
        context: this.toContext(opts),
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
    if (memoKey) {
      this.postMemo.set(memoKey, req);
      // SINGLE-FLIGHT, not a response cache: evict when the promise SETTLES, so
      // concurrent callers still share one round-trip while any LATER call
      // re-fetches.
      //
      // Evicting only on failure made every SUCCESS permanent for the lifetime
      // of the app — and the translate key is `{messageId,target}`, which does
      // not describe the CONTENT being translated. Warm-start research rewrites
      // the intake opener IN PLACE (same row id), so the post-rewrite translate
      // returned the PLACEHOLDER's text; displayContent() prefers
      // translations[lang] over content, which pinned the bubble to "I'm looking
      // your company up right now" for the whole session while the server row
      // was already correct (fid e64b31a6). Re-fetching is cheap: the server
      // persists translations write-through on the row.
      const evict = () => this.postMemo.delete(memoKey);
      // then(evict, evict) — not .finally() — so the eviction promise itself is
      // never an unhandled rejection; `req` is still returned to the caller.
      req.then(evict, evict);
    }
    return req;
  }

  /** Binary POST (file downloads from a POST body) — sibling of getBlob(). */
  postBlob(path: string, body?: unknown): Promise<Blob> {
    return this.send<Blob>(
      this.http.post(this.url(path), body ?? {}, { withCredentials: true, observe: 'body', responseType: 'blob' }),
      this.url(path),
    );
  }

  put<T>(path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
    if (PREVIEW_MODE) return previewRespond<T>('PUT', path);
    return this.send<T>(
      this.http.put<T>(this.url(path), body ?? {}, {
        params: this.toParams(opts.params),
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
  }

  patch<T>(path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
    if (PREVIEW_MODE) return previewRespond<T>('PATCH', path);
    return this.send<T>(
      this.http.patch<T>(this.url(path), body ?? {}, {
        params: this.toParams(opts.params),
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
  }

  delete<T>(path: string, body?: unknown, opts: RequestOpts = {}): Promise<T> {
    if (PREVIEW_MODE) return previewRespond<T>('DELETE', path);
    return this.send<T>(
      this.http.delete<T>(this.url(path), {
        body: body ?? undefined,
        params: this.toParams(opts.params),
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
  }

  /**
   * Multipart upload. Pass `fields` for additional form fields beyond
   * the file. The default field name for the file is `file` — the
   * Documents endpoint uses `FileInterceptor('file')`.
   */
  upload<T>(
    path: string,
    file: File | Blob,
    fields: Record<string, string | Blob> = {},
    fileFieldName = 'file',
  ): Promise<T> {
    const form = new FormData();
    form.append(fileFieldName, file, (file as File).name ?? 'upload');
    for (const [k, v] of Object.entries(fields)) {
      form.append(k, v as string | Blob);
    }
    return this.send<T>(
      this.http.post<T>(this.url(path), form, {
        withCredentials: true,
        observe: 'body',
      }),
      this.url(path),
    );
  }

  /** Raw URL builder — used by SSE callers etc. */
  url(path: string): string {
    if (path.startsWith('http')) return path;
    const trimmed = path.replace(/^\/+/, '').replace(/^api\/?/, '');
    return `${this.base}/${trimmed}`;
  }

  // ─────────────────────────────────────────────────────────────────

  private async send<T>(obs: Observable<T>, url: string): Promise<T> {
    return firstValueFrom(
      obs.pipe(
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse) {
            return throwError(() => mapHttpError(err.status, url, err.error));
          }
          return throwError(() => err);
        }),
      ),
    );
  }

  /** Builds the per-request HttpContext carrying interceptor opt-out flags. */
  private toContext(opts: RequestOpts): HttpContext {
    const ctx = new HttpContext();
    if (opts.skipAuthRedirect) ctx.set(SKIP_AUTH_REDIRECT, true);
    return ctx;
  }

  private toParams(
    params?: Record<string, string | number | boolean | null | undefined>,
  ): HttpParams | undefined {
    if (!params) return undefined;
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      p = p.set(k, String(v));
    }
    return p;
  }
}
