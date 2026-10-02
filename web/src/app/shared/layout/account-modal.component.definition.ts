import { Component, inject, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { ApiClient } from '../api/api-client.service';
import { accountModalStyles } from './account-modal.component.styles';

@Component({
  selector: 'app-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="closed.emit()">
      <div class="account-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ 'Account Settings' }}</h2>
          <button class="close-btn" (click)="closed.emit()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <nav class="settings-nav">
            <button
              type="button"
              class="settings-nav-item"
              [class.active]="activeTab() === 'profile'"
              (click)="activeTab.set('profile')"
            >{{ 'Profile Information' }}</button>
            <button
              type="button"
              class="settings-nav-item"
              [class.active]="activeTab() === 'password'"
              (click)="activeTab.set('password')"
            >{{ 'Change Password' }}</button>
          </nav>
          <div class="settings-content">
          @if (activeTab() === 'profile') {
          <section class="account-section">
            <h3>{{ 'Profile Information' }}</h3>
            <div class="form-group">
              <label>{{ 'Email' }}</label>
              <input type="email" [value]="accountForm.email" class="form-input" readonly disabled />
              <small class="field-note">{{ 'Your email is your login and cannot be changed here.' }}</small>
            </div>
            <div class="form-group">
              <label>{{ 'Display Name' }}</label>
              <input type="text" [(ngModel)]="accountForm.displayName" class="form-input" />
            </div>
            @if (profileMsg()) {
              <small class="status-msg" [class.error]="profileError()">{{ profileMsg() }}</small>
            }
            <button class="btn-primary" (click)="saveProfile()" [disabled]="savingProfile()">
              {{ savingProfile() ? ('Saving…') : ('Save Profile') }}
            </button>
          </section>
          }
          @if (activeTab() === 'password') {
          <section class="account-section">
            <h3>{{ 'Change Password' }}</h3>
            <div class="form-group">
              <label>{{ 'Current Password' }}</label>
              <input type="password" [(ngModel)]="accountForm.currentPassword" class="form-input" />
            </div>
            <div class="form-group">
              <label>{{ 'New Password' }}</label>
              <input type="password" [(ngModel)]="accountForm.newPassword" class="form-input" />
              <small class="field-note">{{ 'At least 8 characters.' }}</small>
            </div>
            <div class="form-group">
              <label>{{ 'Confirm New Password' }}</label>
              <input type="password" [(ngModel)]="accountForm.confirmPassword" class="form-input" />
            </div>
            @if (passwordMsg()) {
              <small class="status-msg" [class.error]="passwordError()">{{ passwordMsg() }}</small>
            }
            <button class="btn-primary" (click)="changePassword()" [disabled]="changingPassword()">
              {{ changingPassword() ? ('Changing…') : ('Change Password') }}
            </button>
          </section>
          }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [accountModalStyles]
})
export class AccountModalComponent implements OnInit {
  closed = output<void>();

  activeTab = signal<'profile' | 'password'>('profile');

  auth = inject(AuthService);
  private api = inject(ApiClient);

  accountForm = {
    email: '',
    displayName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  savingProfile = signal(false);
  profileMsg = signal('');
  profileError = signal(false);
  changingPassword = signal(false);
  passwordMsg = signal('');
  passwordError = signal(false);

  ngOnInit() {
    const u = this.auth.user();
    this.accountForm.email = u?.email ?? '';
    this.accountForm.displayName = u?.name ?? '';
  }

  async saveProfile() {
    const name = this.accountForm.displayName.trim();
    if (!name) {
      this.profileError.set(true);
      this.profileMsg.set('Display name is required.');
      return;
    }
    this.savingProfile.set(true);
    this.profileMsg.set('');
    try {
      const updated = await this.api.patch<{ name: string }>('auth/me', { name });
      this.auth.patchUser({ name: updated.name });
      this.profileError.set(false);
      this.profileMsg.set('Profile saved.');
    } catch {
      this.profileError.set(true);
      this.profileMsg.set('Could not save. Please try again.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async changePassword() {
    this.passwordMsg.set('');
    if (!this.accountForm.currentPassword || !this.accountForm.newPassword) {
      this.passwordError.set(true);
      this.passwordMsg.set('Please fill in all fields.');
      return;
    }
    if (this.accountForm.newPassword.length < 8) {
      this.passwordError.set(true);
      this.passwordMsg.set('New password must be at least 8 characters.');
      return;
    }
    if (this.accountForm.newPassword !== this.accountForm.confirmPassword) {
      this.passwordError.set(true);
      this.passwordMsg.set('Passwords do not match.');
      return;
    }
    this.changingPassword.set(true);
    try {
      await this.api.post('auth/change-password', {
        currentPassword: this.accountForm.currentPassword,
        newPassword: this.accountForm.newPassword,
      });
      this.resetPasswordFields();
      this.passwordError.set(false);
      this.passwordMsg.set('Password changed.');
    } catch (err: unknown) {
      this.passwordError.set(true);
      const status = (err as { status?: number })?.status;
      this.passwordMsg.set(
        status === 401
          ? ('Current password is incorrect.')
          : ('Could not change password. Please try again.'),
      );
    } finally {
      this.changingPassword.set(false);
    }
  }

  resetPasswordFields() {
    this.accountForm.currentPassword = '';
    this.accountForm.newPassword = '';
    this.accountForm.confirmPassword = '';
  }
}
