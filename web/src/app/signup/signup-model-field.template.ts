/**
 * Registration-token field and the read-only "Preferred AI model" field it
 * drives, for {@link SignupComponent}.
 *
 * Extracted verbatim from the component's inline template so the large
 * `signup.component.ts` stays under the editing line limit — the component
 * interpolates these fragments back into its template literal at the same
 * positions, with the same indentation.
 *
 * The model a new user gets is NOT their choice and NOT a deployment-wide
 * default: it is carried by the single-use registration token an admin issued
 * them. So the model field is a static, non-editable element (no `<select>`)
 * that stays blank until a complete token is typed and then displays whatever
 * `GET /api/auth/registration-token/:token` reports.
 *
 * Relies on the host component's `lang()` and `tokenModelLabel()` members, its
 * `signupToken` field and its `onTokenChange(...)` handler.
 */

export const SIGNUP_TOKEN_FIELD_TEMPLATE = `<div class="form-group token-field">
            <label for="signupToken">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {{ 'Registration Token' }} *
            </label>
            <input
              type="text"
              id="signupToken"
              #signupTokenInput
              [ngModel]="signupToken"
              (ngModelChange)="onTokenChange($event)"
              (animationstart)="signupTokenInput.focus()"
              name="signupToken"
              [placeholder]="'Enter your 48-character token'"
              required
              autofocus
              class="token-input"
              maxlength="48"
            />
            <small class="field-hint token-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
              {{ 'This single-use token was provided by an RCT admin to invite you to register.' }}
            </small>
          </div>`;

export const SIGNUP_MODEL_FIELD_TEMPLATE = `<div class="form-group model-field">
            <label for="signupModel">{{ 'Preferred AI model' }}</label>
            <div
              id="signupModel"
              data-testid="signup-model"
              class="model-static"
              [class.is-empty]="!tokenModelLabel()"
              role="note"
              [attr.aria-label]="'AI model'"
              [attr.aria-live]="'polite'"
            >{{ tokenModelLabel() || ('Enter your registration token') }}</div>
            <small class="field-hint">{{ 'This AI model is determined by your registration token and cannot be changed.' }}</small>
          </div>`;
