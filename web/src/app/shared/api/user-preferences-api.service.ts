import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client';

/**
 * Response shape for the per-user default LLM model preference endpoints
 * (`GET`/`PUT /api/users/me/default-model`).
 *
 * `defaultLlmModelId` is `null` when the user has not chosen a default and the
 * system fallback applies. When set it is one of the allow-listed chat model
 * ids (server-discovered via ChatModelsService); the backend validates ids against its
 * own allow-list and rejects unknown values with a 400.
 */
export interface DefaultModelPreference {
  defaultLlmModelId: string | null;
}

/**
 * A single LLM model attached to the current user. The user may attach several
 * allow-listed models (a selectable set) with exactly one marked `isPrimary`,
 * which acts as the default when a chat turn does not specify a model.
 *
 * `modelId` is one of the allow-listed chat model ids (mirrored in
 * ChatModelsService); the backend validates ids against its own allow-list.
 */
export interface AttachedModel {
  modelId: string;
  isPrimary: boolean;
  /**
   * Whether an encrypted per-model API key is stored for this attachment. The
   * plaintext key is never returned by the backend — only this boolean is
   * surfaced.
   */
  hasApiKey: boolean;
  /**
   * Optional display-only masked preview of the stored key (short leading
   * prefix then bullets, e.g. `sk-a••••`). Present only when the backend chooses
   * to surface it; never the real secret and never written back. Absent (and the
   * UI falls back to plain bullets) when the backend does not expose it.
   */
  maskedKey?: string;
  /**
   * Optional provider this model belongs to (`anthropic` | `openai` | `google`
   * | `mistral`), derived by the backend from `modelId` (mirrors the backend
   * `AttachedModelDto.provider`). Lets the UI group attachments by provider and
   * reuse an existing provider key when attaching another model of the same
   * provider. Absent when the backend cannot map the id to a known provider.
   */
  provider?: string;
}

/**
 * Liveness status for a single attached model's API key, returned by
 * `GET /api/users/me/llm-models/:modelId/key-status`.
 *
 * The plaintext key is never returned — only booleans are surfaced:
 * - `hasApiKey` mirrors {@link AttachedModel.hasApiKey} (a key is stored).
 * - `isLive` is the result of a live validity probe against the provider via
 *   the LiteLLM connector. It is `true` when the stored key authenticates,
 *   `false` when the key is rejected/invalid, and `null` when liveness could
 *   not be determined (e.g. no key stored, or the probe was inconclusive).
 * - `error` is a short human-readable reason surfaced when the live probe
 *   failed (mirrors the backend `KeyStatusDto.error`); absent on success.
 */
export interface ModelKeyStatus {
  modelId: string;
  hasApiKey: boolean;
  isLive: boolean | null;
  error?: string;
}

/**
 * Per-model key-status UI state tracked by the Settings → LLM Models status
 * card while it probes each attached model's key liveness. This is the
 * client-side view-model (not a wire shape): it layers a `loading` flag and a
 * normalised `error` onto the {@link ModelKeyStatus.isLive} probe result.
 *
 * - `isLive`: latest liveness verdict (`true`/`false`/`null` indeterminate),
 *   or `null` before the first probe resolves.
 * - `loading`: a key-status probe is currently in flight for this model.
 * - `error`: short reason the last probe failed, or `null` when none.
 */
export interface ModelKeyState {
  isLive: boolean | null;
  loading: boolean;
  error: string | null;
}

/**
 * DTO returned by the multi-model attachment endpoints mounted at
 * `/api/users/me/llm-models`. Mirrors the backend `AttachedModelDto` shape:
 * only the fields needed for the selectable set are exposed (no internal row
 * id / userId / timestamps).
 *
 * `modelId` is one of the allow-listed chat model ids (mirrored in
 * ChatModelsService); the backend validates ids against its own allow-list
 * and rejects unknown values with a 400.
 */
export interface LlmModelDto {
  modelId: string;
  isPrimary: boolean;
  /**
   * Whether an encrypted per-model API key is stored for this attachment. The
   * plaintext key is never returned by the backend — only this boolean is
   * surfaced (mirrors the backend `AttachedModelDto.hasApiKey`).
   */
  hasApiKey: boolean;
  /**
   * Optional display-only masked preview of the stored key (short leading
   * prefix then bullets, e.g. `sk-a••••`). Present only when the backend chooses
   * to surface it; never the real secret and never written back (mirrors the
   * backend `AttachedModelDto.maskedKey`). Absent when not exposed.
   */
  maskedKey?: string;
  /**
   * Optional provider this model belongs to (`anthropic` | `openai` | `google`
   * | `mistral`), derived by the backend from `modelId` (mirrors the backend
   * `AttachedModelDto.provider`). Absent when the id maps to no known provider.
   */
  provider?: string;
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesApi {
  private api = inject(ApiClient);

  /**
   * List the current user's attached models (primary first is not guaranteed).
   * Backed by `GET /api/users/me/llm-models`.
   */
  listModels(): Promise<AttachedModel[]> {
    return this.api.get<AttachedModel[]>('/api/users/me/llm-models');
  }

  /**
   * Attach an allow-listed model to the current user. If it is the first model
   * attached the backend marks it primary. Returns the full updated list.
   * Backed by `POST /api/users/me/llm-models`.
   *
   * An optional `apiKey` is forwarded to the backend, which encrypts it at rest
   * on the attachment; it is never echoed back (only `hasApiKey` is surfaced).
   */
  addModel(modelId: string, apiKey?: string): Promise<AttachedModel[]> {
    return this.api.post<AttachedModel[]>('/api/users/me/llm-models', {
      modelId,
      ...(apiKey != null && apiKey !== '' ? { apiKey } : {}),
    });
  }

  /**
   * Detach a model from the current user. Returns the full updated list. The
   * backend re-assigns primary if the removed model was primary. Backed by
   * `DELETE /api/users/me/llm-models/:modelId`.
   */
  removeModel(modelId: string): Promise<AttachedModel[]> {
    return this.api.delete<AttachedModel[]>(
      `/api/users/me/llm-models/${encodeURIComponent(modelId)}`,
    );
  }

  /**
   * Mark an already-attached model as the user's primary. Returns the full
   * updated list. Backed by `PUT /api/users/me/llm-models/primary`.
   */
  setPrimaryModel(modelId: string): Promise<AttachedModel[]> {
    return this.api.request<AttachedModel[]>(
      '/api/users/me/llm-models/primary',
      { method: 'PUT', body: { modelId } },
    );
  }

  /**
   * Set (or clear) the encrypted per-model API key for an already-attached
   * model. Pass `null` (or omit) to clear the stored key. The plaintext key is
   * encrypted at rest by the backend and never echoed back — the returned list
   * exposes only `hasApiKey`. Backed by
   * `PUT /api/users/me/llm-models/:modelId/api-key`.
   */
  setApiKey(
    modelId: string,
    apiKey: string | null,
  ): Promise<AttachedModel[]> {
    return this.api.request<AttachedModel[]>(
      `/api/users/me/llm-models/${encodeURIComponent(modelId)}/api-key`,
      { method: 'PUT', body: { apiKey } },
    );
  }

  /**
   * List the current user's attached LLM models (the selectable set, with
   * exactly one marked `isPrimary`). Backed by
   * `GET /api/users/me/llm-models`.
   */
  getLlmModels(): Promise<LlmModelDto[]> {
    return this.api.get<LlmModelDto[]>('/api/users/me/llm-models');
  }

  /**
   * Attach an allow-listed model to the current user. If it is the first model
   * attached the backend marks it primary. Returns the full updated list.
   * Backed by `POST /api/users/me/llm-models`.
   *
   * An optional `apiKey` is forwarded to the backend, which encrypts it at rest
   * on the attachment; it is never echoed back (only `hasApiKey` is surfaced).
   */
  addLlmModel(modelId: string, apiKey?: string): Promise<LlmModelDto[]> {
    return this.api.post<LlmModelDto[]>('/api/users/me/llm-models', {
      modelId,
      ...(apiKey != null && apiKey !== '' ? { apiKey } : {}),
    });
  }

  /**
   * Detach a model from the current user. Returns the full updated list. The
   * backend re-assigns primary if the removed model was primary. Backed by
   * `DELETE /api/users/me/llm-models/:modelId`.
   */
  removeLlmModel(modelId: string): Promise<LlmModelDto[]> {
    return this.api.delete<LlmModelDto[]>(
      `/api/users/me/llm-models/${encodeURIComponent(modelId)}`,
    );
  }

  /**
   * Mark an already-attached model as the user's primary. Returns the full
   * updated list. Backed by `PUT /api/users/me/llm-models/primary`.
   */
  setPrimaryLlmModel(modelId: string): Promise<LlmModelDto[]> {
    return this.api.request<LlmModelDto[]>(
      '/api/users/me/llm-models/primary',
      { method: 'PUT', body: { modelId } },
    );
  }

  /**
   * Set (or clear) the encrypted per-model API key for an already-attached
   * model. Pass `null` (or omit) to clear the stored key. The plaintext key is
   * encrypted at rest by the backend and never echoed back — the returned list
   * exposes only `hasApiKey`. Backed by
   * `PUT /api/users/me/llm-models/:modelId/api-key`.
   */
  setLlmModelApiKey(
    modelId: string,
    apiKey: string | null,
  ): Promise<LlmModelDto[]> {
    return this.api.request<LlmModelDto[]>(
      `/api/users/me/llm-models/${encodeURIComponent(modelId)}/api-key`,
      { method: 'PUT', body: { apiKey } },
    );
  }

  /**
   * Read the live API-key status for a single attached model. Surfaces only
   * booleans (`hasApiKey` / `isLive`) — never the plaintext key. Backed by
   * `GET /api/users/me/llm-models/:modelId/key-status`.
   */
  getModelKeyStatus(modelId: string): Promise<ModelKeyStatus> {
    return this.api.get<ModelKeyStatus>(
      `/api/users/me/llm-models/${encodeURIComponent(modelId)}/key-status`,
    );
  }

  /** Read the current user's persisted default model preference. */
  getDefaultModel(): Promise<DefaultModelPreference> {
    return this.api.get<DefaultModelPreference>('/api/users/me/default-model');
  }

  /**
   * Persist the current user's default model preference. Pass `null` to clear
   * the preference and revert to the system default.
   */
  setDefaultModel(
    modelId: string | null,
  ): Promise<DefaultModelPreference> {
    return this.api.request<DefaultModelPreference>(
      '/api/users/me/default-model',
      { method: 'PUT', body: { modelId } },
    );
  }
}
