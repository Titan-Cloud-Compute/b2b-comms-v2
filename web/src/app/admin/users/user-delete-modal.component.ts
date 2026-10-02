import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../shared/auth.service';

/**
 * Destructive confirm modal for an admin-initiated hard delete of a user,
 * opened via the `?delete=<userId>` deep link (the admin Users coordinator and
 * the Organization detail users table both render it when their `deleteUserId`
 * signal is set).
 *
 * Purely presentational: the host owns the API call, the list refresh and the
 * toasts. Confirming emits `confirm`; dismissing (backdrop, Cancel, ✕) emits
 * `close` and the host clears `?delete` from the URL, so the modal state stays
 * fully URL-addressable/shareable.
 *
 * The target is passed as a minimal structural shape (`{ id?, email?, name? }`)
 * rather than a concrete row type, so both the admin Users table (`AdminUser`)
 * and the Organization detail users table can hand their own row straight in.
 * On a direct navigation where the row isn't loaded yet `user` is null and the
 * copy falls back to a generic wording.
 */
export interface UserDeleteTarget {
  id?: string;
  email?: string | null;
  name?: string | null;
}

@Component({
  selector: 'app-user-delete-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" role="dialog" aria-modal="true"
           [attr.aria-label]="'Delete user'"
           (click)="$event.stopPropagation()">
        <h2>{{ 'Delete user' }}</h2>

        <p class="lead">
          @if (label()) {
            {{ 'Permanently delete ' + label() + '? The account and its personal data will be removed for good.'}}
          } @else {
            {{ 'Permanently delete this user? The account and its personal data will be removed for good.' }}
          }
        </p>

        <p class="note">
          {{ "The user's organization and its documents are kept — documents remain, with no owner." }}
        </p>

        <p class="warning">
          {{ 'This action cannot be undone.' }}
        </p>

        <div class="modal-actions">
          <button type="button" class="cancel-btn" [disabled]="deleting" (click)="close.emit()">
            {{ 'Cancel' }}
          </button>
          <button type="button" class="delete-btn" [disabled]="deleting" (click)="confirm.emit()">
            {{ deleting
              ? ('Deleting…')
              : ('Delete user') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(14,23,38,0.45); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000; }
    .modal-card { background: white; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-modal); width: 100%; max-width: 480px; }
    h2 { font-size: var(--font-size-xl); color: var(--color-text-primary); margin: 0 0 0.75rem; }
    .lead { font-size: var(--font-size-md); color: var(--color-text-primary); margin: 0 0 0.75rem; line-height: 1.5; }
    .note { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0 0 0.75rem; line-height: 1.5; }
    .warning { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-error-700); margin: 0 0 1.5rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .cancel-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); background: var(--color-neutral-100); border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .delete-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: white; background: var(--color-error-700); border: none; border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .cancel-btn:disabled, .delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class UserDeleteModalComponent {
  auth = inject(AuthService);

  /**
   * The user being deleted, or null when `?delete=<id>` points at a row that
   * isn't loaded yet (direct navigation) — the copy then stays generic.
   */
  @Input() user: UserDeleteTarget | null = null;
  /** Host-driven busy state while the DELETE request is in flight. */
  @Input() deleting = false;

  /** The admin confirmed the hard delete. */
  @Output() confirm = new EventEmitter<void>();
  /** Dismiss without deleting — the host clears `?delete` from the URL. */
  @Output() close = new EventEmitter<void>();

  /** "Name (email)" / email / name, or '' when nothing is known yet. */
  label(): string {
    const name = (this.user?.name ?? '').trim();
    const email = (this.user?.email ?? '').trim();
    if (name && email) return `${name} (${email})`;
    return name || email;
  }
}
