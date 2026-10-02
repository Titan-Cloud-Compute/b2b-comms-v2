import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUser, CreateUserFormValue, FirmOption, ProvisionRole } from './user.types';

/**
 * Create / detail panel for a single admin user.
 *
 *  - `user` set  → read-only detail of an existing account.
 *  - `user` null → create form. A segmented role toggle picks Admin vs Firm
 *    User (mutually exclusive); the firm picker only appears for Firm User.
 *    Admin ⇒ no firm; Firm User ⇒ a firm must be chosen. Validation and the
 *    exclusivity are enforced here before `save` fires, and again server-side.
 *
 * English labels. Purely presentational — the coordinator
 * owns the API calls and list refresh.
 */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <button type="button" class="back-btn" (click)="back.emit()">
        ← {{ 'Back to users' }}
      </button>

      @if (user) {
        <!-- Detail (read-only) -->
        <h2>{{ user.name || user.email }}</h2>
        <dl class="detail-grid">
          <dt>{{ 'Name' }}</dt>
          <dd>{{ user.name || '—' }}</dd>
          <dt>{{ 'Email' }}</dt>
          <dd>{{ user.email }}</dd>
          <dt>{{ 'Role' }}</dt>
          <dd><span class="role-badge" [class]="user.role">{{ getLocalizedRole(user.role) }}</span></dd>
          <dt>{{ 'Organization' }}</dt>
          <dd>{{ user.firmName || ('— (admin)') }}</dd>
          <dt>{{ 'Created' }}</dt>
          <dd>{{ user.createdAt }}</dd>
        </dl>

        <!-- Admin-initiated password reset. Confirmation + the one-time reveal
             are owned by the coordinator; this is just the bilingual trigger. -->
        <div class="detail-actions">
          <button type="button" class="reset-btn" [disabled]="saving"
                  (click)="resetPassword.emit(user)">
            {{ saving
              ? ('Resetting…')
              : ('Reset password') }}
          </button>
          <p class="help-text">
            {{ 'Generates a new one-time temporary password. The current password stops working.' }}
          </p>
        </div>

        <!-- Hard delete. Opens the deep-linkable confirm modal (?delete=<id>);
             the coordinator owns the confirmation, API call and toasts. -->
        <div class="detail-actions danger-zone">
          <button type="button" class="delete-btn" [disabled]="saving"
                  (click)="deleteRequested.emit(user)">
            {{ 'Delete user' }}
          </button>
          <p class="help-text">
            {{ "Permanently removes the account and its personal data. The organization and its documents are kept." }}
          </p>
        </div>
      } @else {
        <!-- Create -->
        <h2>{{ 'New User' }}</h2>
        <form (ngSubmit)="onSubmit()" class="page-form">
          <div class="form-group">
            <label for="user-name">{{ 'Name' }} *</label>
            <input type="text" id="user-name" name="name" [(ngModel)]="form.name"
                   [placeholder]="'Full name'" required />
          </div>

          <div class="form-group">
            <label for="user-email">{{ 'Email' }} *</label>
            <input type="email" id="user-email" name="email" [(ngModel)]="form.email"
                   placeholder="name@example.com" required />
          </div>

          <div class="form-group">
            <label>{{ 'Role' }} *</label>
            <div class="role-toggle" role="radiogroup"
                 [attr.aria-label]="'User role'">
              <button type="button" class="role-option" [class.active]="form.role === 'ADMIN'"
                      role="radio" [attr.aria-checked]="form.role === 'ADMIN'"
                      (click)="selectRole('ADMIN')">
                {{ 'Admin' }}
              </button>
            </div>
            <p class="help-text">
              {{ 'Admins have full access to the admin console.' }}
            </p>
          </div>

          @if (error) {
            <p class="form-error">{{ error }}</p>
          }

          <div class="form-actions">
            <button type="button" class="cancel-btn" (click)="back.emit()">
              {{ 'Cancel' }}
            </button>
            <button type="submit" class="save-btn" [disabled]="saving">
              {{ saving
                ? ('Creating…')
                : ('Create User') }}
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [`
    .card { background: white; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-card); margin-bottom: 2rem; max-width: 640px; }
    .back-btn { background: none; border: none; color: var(--color-info); font-size: var(--font-size-sm); font-weight: 600; cursor: pointer; padding: 0 0 1rem; }
    h2 { font-size: var(--font-size-xl); color: var(--color-text-primary); margin: 0 0 1.25rem; }
    .detail-grid { display: grid; grid-template-columns: 10rem 1fr; row-gap: 0.75rem; column-gap: 1rem; margin: 0; }
    .detail-grid dt { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; align-self: center; }
    .detail-grid dd { margin: 0; color: var(--color-text-primary); }
    .detail-actions { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-neutral-100); }
    .reset-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-warning-700); background: var(--color-warning-50); border: 1px solid var(--color-warning-200); border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .reset-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .danger-zone { margin-top: 1.25rem; padding-top: 1.25rem; }
    .delete-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-error-700); background: var(--color-error-50); border: 1px solid var(--color-error-200); border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .role-badge { display: inline-flex; padding: 0.25rem 0.625rem; border-radius: var(--radius-pill); font-size: var(--font-size-xs); font-weight: 600; }
    .role-badge.ADMIN { background: var(--color-highlight-100); color: var(--color-highlight-700); }
    .role-badge.USER { background: var(--color-neutral-100); color: var(--color-text-secondary); }
    .page-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-group label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-primary); }
    .form-group input, .form-group select { padding: 0.625rem 0.75rem; font-size: var(--font-size-input); border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); background: white; min-height: 44px; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--color-info); box-shadow: var(--shadow-focus); }
    .help-text { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0.25rem 0 0; }
    .role-toggle { display: inline-flex; border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); overflow: hidden; align-self: flex-start; }
    .role-option { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); background: white; border: none; cursor: pointer; min-height: 44px; }
    .role-option + .role-option { border-left: 1px solid var(--color-gray-300); }
    .role-option.active { background: var(--color-info); color: white; }
    .form-error { color: var(--color-error-700); font-size: var(--font-size-sm); margin: 0; }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .cancel-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); background: var(--color-neutral-100); border: 1px solid var(--color-gray-300); border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .save-btn { padding: 0.625rem 1.25rem; font-size: var(--font-size-sm); font-weight: 600; color: white; background: var(--color-info); border: none; border-radius: var(--radius-btn); cursor: pointer; min-height: 44px; }
    .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class UserFormComponent implements OnChanges {
  /** When set, render the read-only detail view; when null, the create form. */
  @Input() user: AdminUser | null = null;
  /** Firm options for the Firm User picker. */
  @Input() firms: FirmOption[] = [];
  /** Coordinator-driven busy state during the create request. */
  @Input() saving = false;

  @Output() back = new EventEmitter<void>();
  @Output() save = new EventEmitter<CreateUserFormValue>();
  /** Request an admin-initiated password reset for the shown user. */
  @Output() resetPassword = new EventEmitter<AdminUser>();
  /** Request the hard-delete confirm modal (`?delete=<id>`) for the shown user. */
  @Output() deleteRequested = new EventEmitter<AdminUser>();

  form: CreateUserFormValue = { name: '', email: '', role: 'ADMIN', firmId: null };
  error = '';

  ngOnChanges(): void {
    // Reset the create form whenever we switch away from detail mode.
    if (!this.user) {
      this.form = { name: '', email: '', role: 'ADMIN', firmId: null };
      this.error = '';
    }
  }

  selectRole(role: ProvisionRole): void {
    this.form.role = role;
    // Enforce exclusivity in the UI too: an Admin cannot carry a firm.
    if (role === 'ADMIN') this.form.firmId = null;
    this.error = '';
  }

  onSubmit(): void {
    const name = this.form.name.trim();
    const email = this.form.email.trim();

    if (!name) {
      this.error = 'Name is required.';
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error = 'Enter a valid email address.';
      return;
    }
    this.error = '';
    this.save.emit({
      name,
      email,
      role: this.form.role,
      firmId: null,
    });
  }

  getLocalizedRole(role: string): string {
    const labels: Record<string, string> = {
      'ADMIN': 'Admin',
      'USER': 'User',
    };
    return labels[role] || role;
  }
}
