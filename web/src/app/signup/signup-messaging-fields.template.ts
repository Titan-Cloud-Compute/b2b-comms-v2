/**
 * Optional messaging-app contact fields (Viber / WhatsApp) shown on step 3 of
 * the signup wizard, for {@link SignupComponent}.
 *
 * Kept in its own module — like `signup-model-field.template.ts` — so the
 * component file stays small; the component interpolates this fragment back
 * into its template literal at the same indentation.
 *
 * Both numbers are OPTIONAL: no `required`, so wizard validation is unchanged
 * when they are left blank. Relies on the host component's `lang()`,
 * `viberPhone` / `whatsappPhone` fields and `viberLooksValid()` /
 * `whatsappLooksValid()` methods.
 */

export const SIGNUP_MESSAGING_FIELDS_TEMPLATE = `<div class="form-group vat-field" [class.vat-field-invalid]="viberPhone.trim() && !viberLooksValid()">
            <label for="viberPhone">{{ 'Viber number' }} <span class="optional-marker">{{ '(optional)' }}</span></label>
            <input
              type="tel"
              id="viberPhone"
              [(ngModel)]="viberPhone"
              name="viberPhone"
              placeholder="+359 88 123 4567"
              autocomplete="tel"
            />
            @if (viberPhone.trim() && !viberLooksValid()) {
            <small class="field-hint field-hint-warn">{{ 'Invalid number — expected something like +359 88 123 4567' }}</small>
            } @else {
            <small class="field-hint">{{ 'Optional — if you use Viber, we can reach you there.' }}</small>
            }
          </div>

          <div class="form-group vat-field" [class.vat-field-invalid]="whatsappPhone.trim() && !whatsappLooksValid()">
            <label for="whatsappPhone">{{ 'WhatsApp number' }} <span class="optional-marker">{{ '(optional)' }}</span></label>
            <input
              type="tel"
              id="whatsappPhone"
              [(ngModel)]="whatsappPhone"
              name="whatsappPhone"
              placeholder="+359 88 123 4567"
              autocomplete="tel"
            />
            @if (whatsappPhone.trim() && !whatsappLooksValid()) {
            <small class="field-hint field-hint-warn">{{ 'Invalid number — expected something like +359 88 123 4567' }}</small>
            } @else {
            <small class="field-hint">{{ 'Optional — if you use WhatsApp, we can reach you there.' }}</small>
            }
          </div>`;
