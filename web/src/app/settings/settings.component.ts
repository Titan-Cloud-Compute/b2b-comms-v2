import { Component, computed, effect, inject, signal, untracked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../shared/auth.service';
import { ToastService } from '../shared/api/toast.service';
import { DataCache } from '../shared/api/data-cache.service';
import {
  AttachedModel,
  UserPreferencesApi,
} from '../shared/api/user-preferences-api.service';
import { SettingsLlmModelsService } from './settings-llm-models.service';
import { settingsComponentTemplate } from './settings.component.template';
import { settingsComponentStyles } from './settings.component.styles';

/** The deep-linkable settings sections, addressable via `?tab=`. */
type SettingsTab = 'profile' | 'notifications' | 'models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: settingsComponentTemplate,
  styles: [settingsComponentStyles],
})
export class SettingsComponent {
  auth = inject(AuthService);
  /** LLM-models tab concern (T7 Extract Class). Public: the template binds through it. */
  readonly llm = inject(SettingsLlmModelsService);
  private cache = inject(DataCache);
  private toast = inject(ToastService);
  private prefsApi = inject(UserPreferencesApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** The settings tabs, used to validate a `?tab=` deep-link value. */
  private static readonly TABS = ['profile', 'notifications', 'models'] as const;

  /**
   * Which settings section is visible. Synced to the `?tab=` query param so a tab is
   * deep-linkable (e.g. `/settings?tab=models` restores the Models tab).
   */
  activeTab = signal<SettingsTab>('profile');

  constructor() {
    void this.llm.loadModels();

    // Restore the active tab from the `?tab=` query param so a tab is
    // deep-linkable and survives reload / back-forward navigation.
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab && this.isSettingsTab(tab) && tab !== untracked(this.activeTab)) {
        this.activeTab.set(tab);
      }
    });

    // Write the active tab back to the URL whenever it changes (merging so
    // other query params are preserved). `replaceUrl` avoids polluting history
    // on every tab switch.
    effect(() => {
      const tab = this.activeTab();
      untracked(() => {
        if (this.route.snapshot.queryParamMap.get('tab') === tab) return;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });

    // React to the selected model (and the attached list) changing: when the
    // selection shares a provider with an already-keyed model, auto-fill the key
    // input with that model's masked preview and lock it; otherwise clear any
    // value we previously auto-filled (leaving user-typed input untouched).
    effect(
      () => {
        const reuse = this.llm.reusableProviderModel();
        untracked(() => {
          if (reuse) {
            this.llm.apiKeyToAdd.set(this.llm.maskedKeyFor(reuse.modelId));
            this.llm.apiKeyAutoPopulated.set(true);
          } else if (this.llm.apiKeyAutoPopulated()) {
            this.llm.apiKeyToAdd.set('');
            this.llm.apiKeyAutoPopulated.set(false);
          }
        });
      },
      { allowSignalWrites: true },
    );
  }

  /** Type guard for a `?tab=` value against the known settings sections. */
  private isSettingsTab(value: string): value is SettingsTab {
    return (SettingsComponent.TABS as readonly string[]).includes(value);
  }

  /** Human-friendly label for an allow-listed model id (falls back to the id). */
  labelFor(modelId: string): string {
    return modelId;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.llm.apiKeyEditorFor()) this.llm.closeApiKeyEditor();
  }

  async setPrimary(modelId: string) {
    if (this.llm.busyModels()) return;
    this.llm.busyModels.set(true);
    try {
      this.llm.attachedModels.set(await this.prefsApi.setPrimaryModel(modelId));
      this.toast.show('Primary model set', 'success');
    } catch (e: any) {
      this.toast.show(e?.message || ('Failed to set primary'), 'error');
    } finally {
      this.llm.busyModels.set(false);
    }
  }

  profile = {
    name: this.auth.user()?.name || '',
    email: this.auth.user()?.email || '',
  };

  notifications = {
    modules: true,
    weekly: true,
    docs: false,
  };
}
