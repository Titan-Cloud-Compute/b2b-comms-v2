/**
 * Typed error classes the api-client maps HTTP status codes onto.
 * Callers can branch on `instanceof` to surface user-facing messages.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(url: string, message: string, body?: unknown) {
    super(400, url, message, body);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(url: string, message = 'Unauthorized', body?: unknown) {
    super(401, url, message, body);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(url: string, message = 'Forbidden', body?: unknown) {
    super(403, url, message, body);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(url: string, message = 'Not found', body?: unknown) {
    super(404, url, message, body);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(url: string, message = 'Conflict', body?: unknown) {
    super(409, url, message, body);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(url: string, message = 'Service unavailable', body?: unknown) {
    super(503, url, message, body);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Map an HttpErrorResponse-like shape to the right error class.
 */
export function mapHttpError(
  status: number,
  url: string,
  body: unknown,
): ApiError {
  const msg = extractMessage(body) ?? defaultMessageFor(status);
  switch (status) {
    case 400:
      return new BadRequestError(url, msg, body);
    case 401:
      return new UnauthorizedError(url, msg, body);
    case 403:
      return new ForbiddenError(url, msg, body);
    case 404:
      return new NotFoundError(url, msg, body);
    case 409:
      return new ConflictError(url, msg, body);
    case 503:
      return new ServiceUnavailableError(url, msg, body);
    default:
      return new ApiError(status, url, msg, body);
  }
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b['message'] === 'string') return b['message'] as string;
  if (Array.isArray(b['message']) && typeof b['message'][0] === 'string') {
    return (b['message'] as string[]).join('; ');
  }
  if (typeof b['error'] === 'string') return b['error'] as string;
  return null;
}

function defaultMessageFor(status: number): string {
  if (status === 0) return 'Network error';
  if (status >= 500) return 'Server error';
  return `Request failed (${status})`;
}
