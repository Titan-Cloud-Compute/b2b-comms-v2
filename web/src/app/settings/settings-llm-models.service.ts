/**
 * LLM-models concern extracted from `settings.component.ts` (T7) — the whole
 * "LLM models" settings tab: attached models, the add/remove flow, per-model API
 * keys and live key-status probing.
 *
 * Extract Class, not a delegating shim: the 26 members and all 7 signals moved
 * here VERBATIM and the component now exposes this service as `llm`, so the
 * template binds through it (`llm.attachedModels()`, `llm.saveApiKey(...)`).
 * The goal explicitly does not count re-export/delegation shims as done.
 *
 * The seam was verified clean before the move: the cluster referenced exactly
 * three things outside itself — AuthService, UserPreferencesApi and ToastService,
 * all injectable — and every one of its signals was referenced ONLY by cluster
 * members. Nothing else in the component reaches into this state.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { ToastService } from '../shared/api/toast.service';
import {
  AttachedModel,
  UserPreferencesApi,
} from '../shared/api/user-preferences-api.service';
type ChatModelId = string;
function providerForModelId(_modelId: string): string | null { return null; }

/** Stub catalog service — returns an empty model list in the neutral shell. */
class ChatModelsService {
  models = () => [] as Array<{ id: string; label: string }>;
  labelFor(id: string): string { return id; }
}

export type KeyLiveness = 'loading' | 'live' | 'invalid' | 'no-key';

@Injectable({ providedIn: 'root' })
export class SettingsLlmModelsService {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private prefsApi = inject(UserPreferencesApi);
  /** Server-discovered selectable models (admin-enabled ∩ proxy-served). */
  private readonly catalog = new ChatModelsService();

  /** Allow-listed models that can be attached (empty until discovery loads). */
  readonly chatModels = this.catalog.models;

  /** The user's currently attached models (one of which is primary). */
  attachedModels = signal<AttachedModel[]>([]);

  /** Model id selected in the "add model" picker (`''` = none chosen). */
  modelToAdd = signal<ChatModelId | ''>('');
  /**
   * Optional API key entered alongside the model in the "add model" picker.
   * Forwarded to the backend on attach (encrypted at rest) so users can supply
   * the key for the selected model. Never echoed back — only `hasApiKey` is.

  /**
   * Optional API key entered alongside the model in the "add model" picker.
   * Forwarded to the backend on attach (encrypted at rest) so users can supply
   * the key for the selected model. Never echoed back — only `hasApiKey` is.
   */
  apiKeyToAdd = signal<string>('');
  /**
   * True when {@link apiKeyToAdd} currently holds an auto-populated masked
   * preview of an existing provider key (rather than user-typed input). Tracked
   * so we only clear the field we auto-filled, never a value the user typed.

  /**
   * True when {@link apiKeyToAdd} currently holds an auto-populated masked
   * preview of an existing provider key (rather than user-typed input). Tracked
   * so we only clear the field we auto-filled, never a value the user typed.
   */
  apiKeyAutoPopulated = signal<boolean>(false);

  /** True while the initial list is loading. */
  loadingModels = signal<boolean>(false);

  /** True while an add / remove / set-primary mutation is in flight. */
  busyModels = signal<boolean>(false);

  /**
   * Model id whose "Edit API key" popout is open, or `null` when closed. Driven
   * by the per-model "Edit API key" button.

  /**
   * Model id whose "Edit API key" popout is open, or `null` when closed. Driven
   * by the per-model "Edit API key" button.
   */
  apiKeyEditorFor = signal<ChatModelId | null>(null);
  /**
   * Plaintext API key entered in the "Edit API key" popout. Forwarded to the
   * backend on save (encrypted at rest); empty clears the stored key. Never
   * echoed back.

  /**
   * Plaintext API key entered in the "Edit API key" popout. Forwarded to the
   * backend on save (encrypted at rest); empty clears the stored key. Never
   * echoed back.
   */
  modelApiKeyEdit = signal<string>('');

  /**
   * Per-model live API-key status, keyed by model id. Populated by probing the
   * `key-status` endpoint for every attached model on load and after a key is
   * added/updated. Models absent from the map default to `loading` while the
   * probe is in flight.

  /**
   * Per-model live API-key status, keyed by model id. Populated by probing the
   * `key-status` endpoint for every attached model on load and after a key is
   * added/updated. Models absent from the map default to `loading` while the
   * probe is in flight.
   */
  keyStatuses = signal<Record<string, KeyLiveness>>({});


  /** Allow-listed models not yet attached — the choices in the "add" picker. */
  availableModels = computed(() => {
    const attached = new Set(this.attachedModels().map(m => m.modelId));
    return this.catalog.models().filter(m => !attached.has(m.id));
  });

  /**
   * The already-attached model whose stored API key can be reused for the model
   * currently selected in the "add" picker — i.e. it shares the selected model's
   * provider and has a key stored. `null` when nothing is selected, the provider
   * is unknown, or no same-provider key exists.

  /**
   * The already-attached model whose stored API key can be reused for the model
   * currently selected in the "add" picker — i.e. it shares the selected model's
   * provider and has a key stored. `null` when nothing is selected, the provider
   * is unknown, or no same-provider key exists.
   */
  reusableProviderModel = computed<AttachedModel | null>(() => {
    const modelId = this.modelToAdd();
    if (!modelId) return null;
    const provider = providerForModelId(modelId);
    if (!provider) return null;
    return (
      this.attachedModels().find(
        m => m.hasApiKey && providerForModelId(m.modelId) === provider,
      ) ?? null
    );
  });

  /**
   * Whether the "add" form is inheriting an existing provider key for the
   * selected model. When true the key input is read-only (showing a masked
   * preview) and `addModel` sends no new key so the backend reuses the stored one.

  /**
   * Whether the "add" form is inheriting an existing provider key for the
   * selected model. When true the key input is read-only (showing a masked
   * preview) and `addModel` sends no new key so the backend reuses the stored one.
   */
  reusingProviderKey = computed<boolean>(() => this.reusableProviderModel() !== null);

  async loadModels() {
    this.loadingModels.set(true);
    try {
      this.attachedModels.set(await this.prefsApi.listModels());
      void this.loadKeyStatuses();
    } catch {
      // Non-fatal: leave the list empty if the models can't load.
    } finally {
      this.loadingModels.set(false);
    }
  }


  /** Current derived liveness state for a model (defaults to `loading`). */
  keyStatus(modelId: ChatModelId): KeyLiveness {
    return this.keyStatuses()[modelId] ?? 'loading';
  }


  /** Localized (BG/EN) label for a model's key-status badge. */
  keyStatusLabel(modelId: ChatModelId): string {
    switch (this.keyStatus(modelId)) {
      case 'live':
        return 'Live';
      case 'invalid':
        return 'Invalid';
      case 'no-key':
        return 'No key';
      default:
        return 'Checking…';
    }
  }

  /**
   * Probe the live key status for every attached model in parallel and update
   * the {@link keyStatuses} map. Each model is marked `loading` first so the
   * badge reflects the in-flight probe, then resolved to live/invalid/no-key.

  /**
   * Probe the live key status for every attached model in parallel and update
   * the {@link keyStatuses} map. Each model is marked `loading` first so the
   * badge reflects the in-flight probe, then resolved to live/invalid/no-key.
   */
  private async loadKeyStatuses() {
    const models = this.attachedModels();
    // Reset to a loading state for every currently-attached model.
    this.keyStatuses.set(
      models.reduce<Record<string, KeyLiveness>>((acc, m) => {
        acc[m.modelId] = 'loading';
        return acc;
      }, {}),
    );
    await Promise.all(models.map(m => this.refreshKeyStatus(m.modelId)));
  }


  /** Probe and store the live key status for a single model. */
  private async refreshKeyStatus(modelId: ChatModelId) {
    try {
      const status = await this.prefsApi.getModelKeyStatus(modelId);
      this.setKeyStatus(
        modelId,
        !status.hasApiKey
          ? 'no-key'
          : status.isLive === true
            ? 'live'
            : 'invalid',
      );
    } catch {
      // Inconclusive probe (e.g. transient error) — surface as invalid so the
      // user is prompted to re-check rather than silently assuming liveness.
      this.setKeyStatus(modelId, 'invalid');
    }
  }

  private setKeyStatus(modelId: ChatModelId, state: KeyLiveness) {
    this.keyStatuses.update(prev => ({ ...prev, [modelId]: state }));
  }

  async addModel() {
    const modelId = this.modelToAdd();
    if (!modelId || this.busyModels()) return;
    this.busyModels.set(true);
    try {
      // When inheriting an existing provider key, send no apiKey so the backend
      // reuses the stored one (the input only holds a masked preview, not the
      // real secret). Otherwise forward the user-typed key.
      const apiKey = this.reusingProviderKey() ? '' : this.apiKeyToAdd().trim();
      this.attachedModels.set(await this.prefsApi.addModel(modelId, apiKey || undefined));
      this.modelToAdd.set('');
      this.apiKeyToAdd.set('');
      this.apiKeyAutoPopulated.set(false);
      // Probe the newly-attached model's key liveness (and reconcile any others).
      void this.loadKeyStatuses();
      this.toast.show('Model added', 'success');
    } catch (e: any) {
      this.toast.show(e?.message || ('Failed to add model'), 'error');
    } finally {
      this.busyModels.set(false);
    }
  }

  async removeModel(modelId: ChatModelId) {
    if (this.busyModels()) return;
    this.busyModels.set(true);
    try {
      this.attachedModels.set(await this.prefsApi.removeModel(modelId));
      this.toast.show('Model removed', 'success');
    } catch (e: any) {
      this.toast.show(e?.message || ('Failed to remove model'), 'error');
    } finally {
      this.busyModels.set(false);
    }
  }


  /** Open the "Edit API key" popout for a model, clearing any stale input. */
  openApiKeyEditor(modelId: ChatModelId) {
    this.apiKeyEditorFor.set(modelId);
    this.modelApiKeyEdit.set('');
  }


  /** Close the "Edit API key" popout and discard the in-progress input. */
  closeApiKeyEditor() {
    this.apiKeyEditorFor.set(null);
    this.modelApiKeyEdit.set('');
  }

  /** Close any open popout when Escape is pressed anywhere on the page. */

  /**
   * Masked preview of a model's stored key for the popout. Prefers a server
   * supplied `maskedKey` (first few chars) and falls back to plain bullets when
   * the backend only surfaces the `hasApiKey` flag. Empty string when no key.
   */
  maskedKeyFor(modelId: ChatModelId): string {
    const m = this.attachedModels().find(x => x.modelId === modelId);
    if (!m) return '';
    if (m.maskedKey) return m.maskedKey;
    return m.hasApiKey ? '••••••••' : '';
  }

  /**
   * Persist (or clear) the per-model API key entered in the popout, refresh the
   * list and live key status, then close the popout. An empty input clears the
   * stored key.

  /**
   * Persist (or clear) the per-model API key entered in the popout, refresh the
   * list and live key status, then close the popout. An empty input clears the
   * stored key.
   */
  async saveApiKey(modelId: ChatModelId) {
    if (this.busyModels()) return;
    this.busyModels.set(true);
    try {
      const apiKey = this.modelApiKeyEdit().trim();
      this.attachedModels.set(await this.prefsApi.setApiKey(modelId, apiKey || null));
      void this.loadKeyStatuses();
      this.closeApiKeyEditor();
      this.toast.show('API key saved', 'success');
    } catch (e: any) {
      this.toast.show(e?.message || ('Failed to save API key'), 'error');
    } finally {
      this.busyModels.set(false);
    }
  }

  /**
   * Probe the live status of the model's stored key and surface the verdict,
   * letting the user validate the key from within the popout.

  /**
   * Probe the live status of the model's stored key and surface the verdict,
   * letting the user validate the key from within the popout.
   */
  async testApiKey(modelId: ChatModelId) {
    if (this.busyModels()) return;
    this.busyModels.set(true);
    try {
      const status = await this.prefsApi.getModelKeyStatus(modelId);
      this.setKeyStatus(
        modelId,
        !status.hasApiKey ? 'no-key' : status.isLive === true ? 'live' : 'invalid',
      );
      if (!status.hasApiKey) {
        this.toast.show('No key stored', 'error');
      } else if (status.isLive === true) {
        this.toast.show('Key is live', 'success');
      } else {
        this.toast.show(
          ('Key is invalid') + (status.error ? `: ${status.error}` : ''),
          'error',
        );
      }
    } catch (e: any) {
      this.toast.show(e?.message || ('Test failed'), 'error');
    } finally {
      this.busyModels.set(false);
    }
  }
}
