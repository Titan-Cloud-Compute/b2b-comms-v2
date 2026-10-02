/**
 * Errors thrown by integration clients (LiteLLM, Twilio, MinIO) when their
 * required configuration is missing or still set to the placeholder sentinel.
 * The global exception filter maps these to HTTP 503 with a structured body
 * `{ service, message }` and never produces a partial DB write.
 */
export class ServiceUnconfiguredError extends Error {
  readonly service: string;

  constructor(service: string, message?: string) {
    super(
      message ??
        `${service} is not configured — set credentials via /api/admin/settings`,
    );
    this.name = 'ServiceUnconfiguredError';
    this.service = service;
  }
}

/** Machine-readable code the frontend branches on for the unavailable-model
 *  rejection (mirrors CHAT_QUOTA_EXCEEDED — branch on code, not status). */
export const MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE';

/**
 * Thrown when the LLM proxy rejects a request because the requested model id
 * is not in its served set (LiteLLM 400 "Invalid model name"). This is a
 * deterministic catalog/config drift failure, NOT a transient outage: the
 * global exception filter maps it to HTTP 400 `{ code: MODEL_UNAVAILABLE,
 * modelId }` so clients fail fast instead of retrying (the pre-2026-08 bug:
 * it surfaced as a generic 503 and the UI retried a permanent failure 3×).
 */
export class ModelUnavailableError extends Error {
  readonly modelId: string;

  constructor(modelId: string) {
    super(`model '${modelId}' is not available on the LLM proxy`);
    this.name = 'ModelUnavailableError';
    this.modelId = modelId;
  }
}

/**
 * Thrown by integration clients when the service is configured but
 * unreachable at request time (DNS failure, timeout, network refused).
 * Maps to HTTP 503 with the same `{ service, message }` body.
 */
export class ServiceUnreachableError extends Error {
  readonly service: string;

  constructor(service: string, message?: string, cause?: unknown) {
    super(message ?? `${service} is unreachable`, cause ? { cause } : undefined);
    this.name = 'ServiceUnreachableError';
    this.service = service;
  }
}

/**
 * Thrown when an admin or service attempts to reassign a firm's `rctArm`
 * after it has already been set. The randomized arm is immutable by design.
 * Maps to HTTP 409.
 */
export class RctArmAlreadyAssignedError extends Error {
  constructor(message?: string) {
    super(message ?? 'rctArm has already been assigned to this firm');
    this.name = 'RctArmAlreadyAssignedError';
  }
}

/**
 * Thrown when a firm attempts to complete onboarding a second time, or when
 * a guard detects onboarding state that conflicts with the requested action.
 * Maps to HTTP 409.
 */
export class OnboardingConflictError extends Error {
  constructor(message?: string) {
    super(message ?? 'Onboarding has already been completed for this firm');
    this.name = 'OnboardingConflictError';
  }
}

/**
 * Thrown when a request tries to mutate a field that is locked
 * (e.g. `rctArm` after assignment). Maps to HTTP 403.
 */
export class ForbiddenFieldError extends Error {
  constructor(message?: string) {
    super(message ?? 'This field cannot be modified');
    this.name = 'ForbiddenFieldError';
  }
}

/**
 * Thrown when a KPI computation or diagnostic pipeline cannot proceed
 * because the firm has not provided enough source data. `missing` lists
 * the symbolic identifiers of the missing inputs so the frontend can
 * point the user back to the right document upload page.
 * Maps to HTTP 422.
 */
export class InsufficientDiagnosticDataError extends Error {
  readonly missing: string[];

  constructor(missing: string[], message?: string) {
    super(
      message ??
        `Insufficient diagnostic data: ${missing.join(', ')}`,
    );
    this.name = 'InsufficientDiagnosticDataError';
    this.missing = missing;
  }
}

/**
 * Sentinel value used in env vars and SystemSetting rows to indicate the value
 * was bootstrapped but not yet configured by an admin. resolveConfig() treats
 * this exactly like an unset value.
 */
export const CONFIG_PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';
