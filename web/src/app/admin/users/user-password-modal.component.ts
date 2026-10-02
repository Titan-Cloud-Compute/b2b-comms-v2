import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../shared/auth.service';
import { ToastService } from '../../shared/api/toast.service';

/**
 * One-time temporary-password reveal modal, opened via the `?created=<id>`
 * deep link (the coordinator renders it when `createdUserId()` is set).
 *
 * The password itself is transient — it lives only in the coordinator's
 * `temporaryPassword` signal, never in the URL or DB. So:
 *   - fresh create → `password` is present → show it with a Copy button that
 *     writes to the clipboard and fires a bilingual success toast.
 *   - direct navigation / refresh of `?created=<id>` → `password` is null →
 *     show a bilingual "no longer available" note instead of a value.
 *
 * Purely presentational: dismissing emits `close`, and the coordinator clears
 * `?created` from the URL so the modal state stays fully URL-addressable.
 */
@Component({
  selector: 'app-user-password-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" role="dialog" aria-modal="true"
           [attr.aria-label]="'Temporary password'"
           (click)="$event.stopPropagation()">
        <h2>{{ reset
          ? ('Password reset')
          : ('User created') }}</h2>

        @if (password) {
          <p class="lead">
            {{ 'Copy the temporary password and share it securely with the user. It will not be shown again.' }}
          </p>
          <div class="password-row">
            <code class="password-value">{{ password }}</code>
            <button type="button" class="copy-btn" (click)="copy()">
              {{ 'Copy' }}
            </button>
          </div>
        } @else {
          <p class="lead unavailable">
            {{ 'The temporary password is no longer available. It is shown only once, right after the user is created.' }}
          </p>
        }

        <div class="modal-actions">
          <button type="button" class="close-btn" (click)="close.emit()">
            {{ 'Close' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(14,23,38,0.45); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000; }
    .modal-card { background: white; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-modal); width: 100%; max-width: 480px; }
    h2 { font-size: var(--font-size-xl); color: var(--color-text-primary); margin: 0 0 0.75rem; }
    .lead { font-size: var(--font-size-md); color: var(--color-text-secondary); margin: 0 0 1.25rem; line-height: 1.5; }
    .lead.unavailable { color: var(--color-warning-700); }
    .password-row { display: flex; align-items: stretch; gap: 0.5rem; margin-bottom: 1.5rem; }
    .password-value { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--font-size-lg); letter-spacing: 0.02em; background: var(--color-neutral-100); border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); padding: 0.75rem; color: var(--color-text-primary); word-break: break-all; display: flex; align-items: center; }
    .copy-btn { flex: 0 0 auto; padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: white; background: var(--color-info); border: none; border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .modal-actions { display: flex; justify-content: flex-end; }
    .close-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); background: var(--color-neutral-100); border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
  `]
})
export class UserPasswordModalComponent {
  auth = inject(AuthService);
  private toast = inject(ToastService);

  /** The transient one-time password, or null on direct navigation/refresh. */
  @Input() password: string | null = null;
  /** Reset-flow variant (`?reset=<id>`) — switches the heading to a reset label. */
  @Input() reset = false;

  @Output() close = new EventEmitter<void>();

  async copy(): Promise<void> {
    const value = this.password;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.toast.show('Copied', 'success');
    } catch {
      this.toast.show(
        'Copy failed',
        'error',
      );
    }
  }
}
