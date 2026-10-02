/**
 * ApiClient hierarchy for the NestJS REST backend.
 *
 * Abstract base:  ApiClient       — DI token + convenience helpers
 * HTTP impl:      HttpApiClient   — fetch-based, sends cookies, maps HTTP errors
 * Mock impl:      MockApiClient   — in-memory handlers, used when USE_MOCKS is set
 *
 * Status mapping (matches GlobalExceptionFilter on the backend):
 *   400 → BadRequestError
 *   401 → UnauthorizedError
 *   403 → ForbiddenError
 *   404 → NotFoundError
 *   409 → ConflictError
 *   503 → ServiceUnavailableError (`{ service, message }` body)
 *   otherwise → ApiError
 */

import { Injectable } from '@angular/core';

// ─── Error classes ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
export class BadRequestError extends ApiError {
  constructor(message: string, body?: any) {
    super(400, message, body);
    this.name = 'BadRequestError';
  }
}
export class UnauthorizedError extends ApiError {
  constructor(message: string, body?: any) {
    super(401, message, body);
    this.name = 'UnauthorizedError';
  }
}
export class ForbiddenError extends ApiError {
  constructor(message: string, body?: any) {
    super(403, message, body);
    this.name = 'ForbiddenError';
  }
}
export class NotFoundError extends ApiError {
  constructor(message: string, body?: any) {
    super(404, message, body);
    this.name = 'NotFoundError';
  }
}
export class ConflictError extends ApiError {
  constructor(message: string, body?: any) {
    super(409, message, body);
    this.name = 'ConflictError';
  }
}
export class ServiceUnavailableError extends ApiError {
  service?: string;
  constructor(message: string, body?: any) {
    super(503, message, body);
    this.name = 'ServiceUnavailableError';
    this.service = body?.service;
  }
}

// ─── Request options ──────────────────────────────────────────────────────────

export interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** When true, body is sent as FormData (use for file uploads). */
  multipart?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

/**
 * Listener interface so the global HTTP interceptor can react to errors
 * (e.g. push the router to /login on 401, show a toast on 403 / 503).
 * Subscribers are notified for every non-2xx response from `request()`.
 */
export type ApiErrorListener = (err: ApiError) => void;

// ─── Abstract base class (DI token) ──────────────────────────────────────────

/**
 * Abstract ApiClient — use this as the DI token.
 *
 * Provide either HttpApiClient (production) or MockApiClient (USE_MOCKS) in
 * app.config.ts:
 *   { provide: ApiClient, useClass: environment.useMocks ? MockApiClient : HttpApiClient }
 */
@Injectable()
export abstract class ApiClient {
  /** Core method — subclasses implement this. */
  abstract request<T = unknown>(path: string, opts?: RequestOpts): Promise<T>;

  get<T = unknown>(path: string, query?: RequestOpts['query']): Promise<T> {
    return this.request<T>(path, { method: 'GET', query });
  }
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }
  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }
  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
  postMultipart<T = unknown>(path: string, form: FormData): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: form, multipart: true });
  }
}

// ─── HTTP implementation ──────────────────────────────────────────────────────

/**
 * HttpApiClient — fetch-based implementation for production.
 *
 * - sends cookies on every request (`credentials: 'include'`) so the httpOnly
 *   JWT session cookie set by /api/auth/login is round-tripped automatically
 * - JSON request / response handling with multipart support for file uploads
 * - maps HTTP error codes to typed error classes
 */
@Injectable()
export class HttpApiClient extends ApiClient {
  /**
   * In dev, ng serve typically proxies /api to the backend.
   * In prod, both are served from the same host so a relative base works.
   */
  baseUrl = '';

  private listeners: ApiErrorListener[] = [];

  onError(fn: ApiErrorListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private emit(err: ApiError): void {
    for (const fn of this.listeners) {
      try { fn(err); } catch { /* listener errors must never re-throw */ }
    }
  }

  private buildUrl(path: string, query?: RequestOpts['query']): string {
    // Resolve RELATIVE when no explicit baseUrl is set: fetch() resolves a
    // relative URL against the document base, which carries the deployment's
    // path prefix. The previous absolute form escaped that prefix and 404'd.
    const rel = path.replace(/^\/+/, '');
    const url = this.baseUrl ? `${this.baseUrl}/${rel}` : rel;
    if (!query) return url;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      qs.append(k, String(v));
    }
    const s = qs.toString();
    return s ? `${url}?${s}` : url;
  }

  override async request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
    const { method = 'GET', body, multipart, query, signal } = opts;
    const url = this.buildUrl(path, query);

    const headers: Record<string, string> = { Accept: 'application/json' };
    let payload: BodyInit | undefined = undefined;

    if (body !== undefined) {
      if (multipart) {
        if (body instanceof FormData) {
          payload = body;
        } else {
          const fd = new FormData();
          for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
            if (v instanceof Blob || v instanceof File) {
              fd.append(k, v);
            } else if (v !== undefined && v !== null) {
              fd.append(k, String(v));
            }
          }
          payload = fd;
        }
        // intentionally do NOT set Content-Type — browser sets the multipart boundary
      } else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: payload,
        credentials: 'include',
        signal,
      });
    } catch (networkErr: any) {
      const err = new ServiceUnavailableError(
        networkErr?.message || 'Network error',
        { service: 'network' },
      );
      this.emit(err);
      throw err;
    }

    // 204 No Content
    if (res.status === 204) return undefined as unknown as T;

    const ct = res.headers.get('content-type') || '';
    let parsed: any = null;
    if (ct.includes('application/json')) {
      parsed = await res.json().catch(() => null);
    } else if (ct.startsWith('text/')) {
      parsed = await res.text().catch(() => null);
    }

    if (!res.ok) {
      const message = (parsed && (parsed.message || parsed.error)) || res.statusText || `HTTP ${res.status}`;
      let err: ApiError;
      switch (res.status) {
        case 400: err = new BadRequestError(message, parsed); break;
        case 401: err = new UnauthorizedError(message, parsed); break;
        case 403: err = new ForbiddenError(message, parsed); break;
        case 404: err = new NotFoundError(message, parsed); break;
        case 409: err = new ConflictError(message, parsed); break;
        case 503: err = new ServiceUnavailableError(message, parsed); break;
        default:  err = new ApiError(res.status, message, parsed);
      }
      this.emit(err);
      throw err;
    }

    return parsed as T;
  }
}

// ─── Mock implementation ──────────────────────────────────────────────────────

/** Handler function type for MockApiClient — receives the request body and returns a response. */
export type MockHandler<T = unknown> = (body?: unknown) => Promise<T>;

/**
 * MockApiClient — in-memory implementation for USE_MOCKS mode.
 *
 * Feature cards register handlers for their endpoints:
 *
 *   mockClient.registerMock('GET', '/api/my-feature/items', async () => fixtures.items);
 *   mockClient.registerMock('POST', '/api/my-feature/items', async (body) => ({ ...body, id: '1' }));
 *
 * Handlers are keyed by `${METHOD} ${path}` (upper-cased method).
 *
 * Seed from contract fixtures when present (uncomment and adapt):
 *   // import type { MyFixtures } from '@contracts/my-feature/fixtures';
 *   // import { myFixtures } from '@contracts/my-feature/fixtures';
 *   // mockClient.registerMock('GET', '/api/my-feature/items', async () => myFixtures.items);
 */
@Injectable()
export class MockApiClient extends ApiClient {
  private readonly handlers = new Map<string, MockHandler>();

  /**
   * Register a mock handler for a given HTTP method + path combination.
   * Call this during app initialisation (e.g. in app.config.ts) or inside
   * the feature's own initialiser.
   */
  registerMock<T = unknown>(method: string, path: string, handler: MockHandler<T>): void {
    this.handlers.set(`${method.toUpperCase()} ${path}`, handler as MockHandler);
  }

  override async request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
    const method = (opts.method ?? 'GET').toUpperCase();
    const key = `${method} ${path}`;
    const handler = this.handlers.get(key);
    if (!handler) {
      throw new NotFoundError(`[MockApiClient] No mock registered for ${key}`);
    }
    return handler(opts.body) as Promise<T>;
  }
}
