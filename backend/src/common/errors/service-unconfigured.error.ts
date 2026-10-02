/**
 * Thrown by any integration client (LiteLLM, Twilio, MinIO, …) when the
 * configuration required to talk to that service has not been provided —
 * either the relevant environment variable is unset, or the resolved value
 * is the well-known placeholder `PLACEHOLDER_CONFIGURE_IN_SETTINGS`.
 *
 * The GlobalExceptionFilter converts this into an HTTP 503 with a
 * structured body so the frontend can present a "this feature isn't
 * configured" UI instead of a generic crash.
 */
export class ServiceUnconfiguredError extends Error {
  public readonly service: string;

  constructor(service: string, message?: string) {
    super(message ?? `Service "${service}" is not configured.`);
    this.name = 'ServiceUnconfiguredError';
    this.service = service;
    Object.setPrototypeOf(this, ServiceUnconfiguredError.prototype);
  }
}
