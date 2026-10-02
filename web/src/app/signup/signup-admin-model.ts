import { WritableSignal } from '@angular/core';
import { AuthApi } from '../shared/api/auth-api.service';

/** A registration token is 48 hex chars (randomBytes(24).toString('hex')). */
const TOKEN_RE = /^[a-fA-F0-9]{48}$/;

/** How long we wait after the last keystroke before hitting the API. */
const DEBOUNCE_MS = 250;

/**
 * Resolves the AI model a REGISTRATION TOKEN grants, for the signup page's
 * read-only "Preferred AI model" field.
 *
 * The model a new user gets is not their choice and not a deployment-wide
 * default — it is carried by the single-use token an admin issued them. So the
 * field stays blank until a complete (48 hex char) token is typed, then shows
 * exactly what `GET /api/auth/registration-token/:token` reports.
 *
 * Debounced, with a request-sequence guard so a slow response for an older
 * token can never overwrite the label for a newer one.
 */
export class TokenModelResolver {
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly authApi: AuthApi,
    /** Label rendered in the static model field ('' = "enter your token"). */
    private readonly label: WritableSignal<string>,
    /** Called with the resolved model id so it can be persisted for chat. */
    private readonly onResolved: (modelId: string) => void,
  ) {}

  /** Feed every keystroke of the token input through here. */
  onTokenChange(raw: string): void {
    this.cancel();
    const token = (raw ?? '').trim().toLowerCase();
    const seq = ++this.seq;
    if (!TOKEN_RE.test(token)) {
      // Incomplete/malformed token — nothing to show yet.
      this.label.set('');
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.resolve(token, seq);
    }, DEBOUNCE_MS);
  }

  /** Cancel any pending lookup (component teardown). */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.seq++;
  }

  private async resolve(token: string, seq: number): Promise<void> {
    // previewRegistrationToken never throws — an unknown token resolves to
    // { valid: false, models: [] }, which simply leaves the field blank.
    const preview = await this.authApi.previewRegistrationToken(token);
    if (seq !== this.seq) return; // a newer token superseded this lookup
    const model = preview.valid ? preview.models[0] : undefined;
    if (!model?.id) {
      this.label.set('');
      return;
    }
    this.label.set(model.label || model.id);
    this.onResolved(model.id);
  }
}
