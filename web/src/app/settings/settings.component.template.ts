/** Extracted inline template for {@link SettingsComponent}. Moved verbatim out of
 *  settings.component.ts (which exceeded the 500-line module limit). Pure structural
 *  move — the markup is unchanged. Mirrors intake.component.styles.ts and
 *  integrations.component.template.ts. */
export const settingsComponentTemplate = `
    <div class="settings-page" data-placeholder>
      <header class="page-header">
        <h1>{{ 'Settings' }}</h1>
        <p class="muted">{{ 'Manage your profile and preferences.' }}</p>
      </header>

      <div class="settings-tabs" role="tablist" [attr.aria-label]="'Settings sections'">
        <button type="button" role="tab" id="settings-tab-profile" class="settings-tab"
          [class.active]="activeTab() === 'profile'"
          [attr.aria-selected]="activeTab() === 'profile'"
          [attr.tabindex]="activeTab() === 'profile' ? 0 : -1"
          aria-controls="settings-panel-profile"
          (click)="activeTab.set('profile')"
        >{{ 'Profile' }}</button>
        <button type="button" role="tab" id="settings-tab-notifications" class="settings-tab"
          [class.active]="activeTab() === 'notifications'"
          [attr.aria-selected]="activeTab() === 'notifications'"
          [attr.tabindex]="activeTab() === 'notifications' ? 0 : -1"
          aria-controls="settings-panel-notifications"
          (click)="activeTab.set('notifications')"
        >{{ 'Notifications' }}</button>
        <button type="button" role="tab" id="settings-tab-models" class="settings-tab"
          [class.active]="activeTab() === 'models'"
          [attr.aria-selected]="activeTab() === 'models'"
          [attr.tabindex]="activeTab() === 'models' ? 0 : -1"
          aria-controls="settings-panel-models"
          (click)="activeTab.set('models')"
        >{{ 'LLM models' }}</button>
      </div>

      <div class="settings-grid">
        <!-- Profile -->
        @if (activeTab() === 'profile') {
        <section class="card" role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
          <h2>{{ 'Profile' }}</h2>
          <div class="row">
            <label>{{ 'Name' }}</label>
            <input type="text" [(ngModel)]="profile.name" />
          </div>
          <div class="row">
            <label>{{ 'Email' }}</label>
            <input type="email" [(ngModel)]="profile.email" />
          </div>
          <button class="btn btn-primary">{{ 'Save' }}</button>
        </section>
        }

        <!-- Consent -->

        <!-- Notifications -->
        @if (activeTab() === 'notifications') {
        <section class="card" role="tabpanel" id="settings-panel-notifications" aria-labelledby="settings-tab-notifications">
          <h2>{{ 'Notifications' }}</h2>
          <label class="toggle-row">
            <span>{{ 'Email for new modules' }}</span>
            <input type="checkbox" [(ngModel)]="notifications.modules" />
          </label>
          <label class="toggle-row">
            <span>{{ 'Weekly summary' }}</span>
            <input type="checkbox" [(ngModel)]="notifications.weekly" />
          </label>
          <label class="toggle-row">
            <span>{{ 'Document processing alerts' }}</span>
            <input type="checkbox" [(ngModel)]="notifications.docs" />
          </label>
          <!-- Account-level opt-in shared with the diagnostic page: report
               generation is long running, so the user can be emailed on
               completion instead of watching the progress panel. -->
          <label class="toggle-row">
            <span>{{ 'Email me when my diagnostic report is ready' }}</span>
            <input
              type="checkbox"
              [checked]="auth.diagnosticReadyEmail()"
              (change)="auth.setDiagnosticReadyEmail($any($event.target).checked)"
            />
          </label>
        </section>
        }

        <!-- LLM models -->
        @if (activeTab() === 'models') {
        <section class="card models-card" role="tabpanel" id="settings-panel-models" aria-labelledby="settings-tab-models">
          <h2>{{ 'LLM models' }}</h2>
          <p class="muted">{{ 'Attach the models you want available in chat. The primary one is used when no model is chosen for a specific turn, and governs how your profile and diagnostic are generated.' }}</p>

          @if (llm.loadingModels()) {
            <p class="hint">{{ 'Loading…' }}</p>
          } @else {
            @if (llm.attachedModels().length === 0) {
              <p class="muted empty-models">{{ 'No models attached yet. Add at least one below.' }}</p>
            } @else {
              <ul class="model-list">
                @for (m of llm.attachedModels(); track m.modelId) {
                  <li class="model-item">
                    <span class="model-name">
                      {{ labelFor(m.modelId) }}
                      @if (m.isPrimary) {
                        <span class="badge ok">{{ 'Primary' }}</span>
                      }
                      @if (m.hasApiKey) {
                        <span class="badge ok">{{ 'API key' }}</span>
                      }
                      <span
                        class="badge key-status"
                        [class.ok]="llm.keyStatus(m.modelId) === 'live'"
                        [class.error]="llm.keyStatus(m.modelId) === 'invalid'"
                        [class.warn]="llm.keyStatus(m.modelId) === 'no-key'"
                        [class.neutral]="llm.keyStatus(m.modelId) === 'loading'"
                        [attr.aria-live]="'polite'"
                        [attr.title]="llm.keyStatusLabel(m.modelId)"
                      >{{ llm.keyStatusLabel(m.modelId) }}</span>
                    </span>
                    <span class="model-actions">
                      <button
                        class="btn btn-ghost btn-sm"
                        data-testid="model-api-key-edit"
                        [attr.aria-label]="'Edit API key'"
                        (click)="llm.openApiKeyEditor(m.modelId)"
                        [disabled]="llm.busyModels()"
                      >{{ 'Edit API key' }}</button>
                      @if (!m.isPrimary) {
                        <button
                          class="btn btn-ghost btn-sm"
                          (click)="setPrimary(m.modelId)"
                          [disabled]="llm.busyModels()"
                        >{{ 'Make primary' }}</button>
                      }
                      <button
                        class="btn btn-ghost btn-sm btn-danger-text"
                        (click)="llm.removeModel(m.modelId)"
                        [disabled]="llm.busyModels()"
                      >{{ 'Remove' }}</button>
                    </span>
                  </li>
                }
              </ul>
            }

            @if (llm.availableModels().length > 0) {
              <div class="row add-model-row">
                <label for="add-model">{{ 'Add model' }}</label>
                <div class="add-model-controls">
                  <select
                    id="add-model"
                    [ngModel]="llm.modelToAdd()"
                    (ngModelChange)="llm.modelToAdd.set($event)"
                    [disabled]="llm.busyModels()"
                  >
                    <option value="">{{ 'Choose…' }}</option>
                    @for (m of llm.availableModels(); track m.id) {
                      <option [value]="m.id">{{ m.label }}</option>
                    }
                  </select>
                  <input
                    id="add-model-key"
                    data-testid="add-model-key"
                    [type]="llm.reusingProviderKey() ? 'text' : 'password'"
                    autocomplete="off"
                    [ngModel]="llm.apiKeyToAdd()"
                    (ngModelChange)="llm.apiKeyToAdd.set($event)"
                    [disabled]="llm.busyModels()"
                    [readonly]="llm.reusingProviderKey()"
                    [attr.aria-label]="'API key (optional)'"
                    [placeholder]="'API key (optional)'"
                  />
                  <button
                    class="btn btn-primary btn-sm"
                    (click)="llm.addModel()"
                    [disabled]="!llm.modelToAdd() || llm.busyModels()"
                  >{{ 'Add' }}</button>
                </div>
                @if (llm.reusingProviderKey()) {
                  <p class="hint" data-testid="add-model-key-reuse-hint">{{ 'You already have an API key for this provider — the existing key will be reused for this model.' }}</p>
                } @else {
                  <p class="hint">{{ 'Optionally provide an API key for the selected model. The key is stored encrypted and never shown again.' }}</p>
                }
              </div>
            }

            @if (llm.busyModels()) {
              <p class="hint">{{ 'Saving…' }}</p>
            }
          }
        </section>
        }

      </div>

      <!-- Edit API key popout -->
      @if (llm.apiKeyEditorFor()) {
        <div class="modal-overlay" (click)="llm.closeApiKeyEditor()">
          <div
            class="modal-dialog"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'Edit API key'"
          >
            <h3>{{ 'Edit API key' }} — {{ labelFor(llm.apiKeyEditorFor()!) }}</h3>
            <div class="row">
              <label>{{ 'Current key' }}</label>
              <div class="masked-key">{{ llm.maskedKeyFor(llm.apiKeyEditorFor()!) || ('No key stored') }}</div>
            </div>
            <div class="row">
              <label for="edit-api-key-input">{{ 'New API key' }}</label>
              <input
                id="edit-api-key-input"
                data-testid="model-api-key-input"
                type="password"
                autocomplete="off"
                [ngModel]="llm.modelApiKeyEdit()"
                (ngModelChange)="llm.modelApiKeyEdit.set($event)"
                [attr.aria-label]="'New API key'"
                [placeholder]="'New API key'"
              />
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost" (click)="llm.closeApiKeyEditor()" [disabled]="llm.busyModels()">{{ 'Cancel' }}</button>
              <button class="btn btn-ghost" data-testid="model-api-key-test" (click)="llm.testApiKey(llm.apiKeyEditorFor()!)" [disabled]="llm.busyModels()">{{ 'Test' }}</button>
              <button class="btn btn-primary" data-testid="model-api-key-save" (click)="llm.saveApiKey(llm.apiKeyEditorFor()!)" [disabled]="llm.busyModels()">{{ 'Save' }}</button>
            </div>
          </div>
        </div>
      }

    </div>
`;
