import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService } from '../shared/auth.service';
import { StickyFooterComponent } from '../shared/sticky-footer.component';
import { AuthApi } from '../shared/api/auth-api.service';
import {
  UnauthorizedError,
  BadRequestError,
} from '../shared/api/api-errors';
import { PREVIEW_MODE } from '../shared/preview/preview-mode';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StickyFooterComponent],
  styleUrl: './login.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="login-page" @fadeIn>
      <div class="login-container">
        <!-- Sign-in form only. The brand copy and product journey live on the
             public /about page (linked below) so nothing competes with the
             single action on this screen. -->
      <div class="form-panel">
        <div class="form-container">
          <h2 class="form-title">{{ 'Sign In' }}</h2>
          <p class="form-subtitle">{{ 'Access your company profile' }}</p>

          <form (ngSubmit)="onLogin()" class="login-form">
            @if (error()) {
              <div class="error-message">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                {{ error() }}
              </div>
            }

            <div class="form-group">
              <label for="email">{{ 'Email' }}</label>
              <input
                type="email"
                id="email"
                [(ngModel)]="email"
                name="email"
                placeholder="martin@example.bg"
                required
                autocomplete="email"
              />
              @if (emailError()) {
                <small class="field-error">{{ emailError() }}</small>
              }
            </div>

            <div class="form-group">
              <label for="password">{{ 'Password' }}</label>
              <div class="password-row">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  id="password"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? ('Hide password') : ('Show password')"
                  [attr.title]="showPassword() ? ('Hide password') : ('Show password')"
                  [attr.aria-pressed]="showPassword()"
                >
                  @if (showPassword()) {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
              <a routerLink="/forgot-password" class="forgot-link">{{ 'Forgot password?' }}</a>
              @if (passwordError()) {
                <small class="field-error">{{ passwordError() }}</small>
              }
            </div>

            <button type="submit" class="btn-primary" [disabled]="isLoading()">
              @if (isLoading()) {
                <span class="spinner"></span>
                {{ 'Signing in...' }}
              } @else {
                {{ 'Sign In' }}
              }
            </button>
          </form>

          <div class="signup-link">
            <p class="about-link">
              <a routerLink="/about">{{ 'About this platform' }}</a>
            </p>
          </div>

        </div>
      </div>
    </div>

    <app-sticky-footer></app-sticky-footer>
  </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  emailError = signal<string | null>(null);
  passwordError = signal<string | null>(null);
  isLoading = signal(false);
  showPassword = signal(false);

  /** True only in the static design-review build (see preview-mode.ts). */
  previewMode = PREVIEW_MODE;

  auth = inject(AuthService);
  private authApi = inject(AuthApi);
  private route = inject(ActivatedRoute);


  constructor(private router: Router) {}

  private validate(): boolean {
    let ok = true;
    this.emailError.set(null);
    this.passwordError.set(null);

    if (!this.email) {
      this.emailError.set('Email is required');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.emailError.set('Please enter a valid email address');
      ok = false;
    }

    if (!this.password) {
      this.passwordError.set('Password is required');
      ok = false;
    } else if (this.password.length < 4) {
      this.passwordError.set('Password is too short');
      ok = false;
    }

    return ok;
  }

  async onLogin() {
    if (!this.validate()) return;

    // Static design-review preview: there is no backend to ask, and awaiting a
    // request that cannot succeed would strand the reviewer on this screen with
    // a generic error. validate() has already required a non-empty,
    // address-shaped email and a non-empty password — in the preview that IS
    // the whole credential check, resolved here in the client.
    if (PREVIEW_MODE) {
      this.previewSignIn();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.authApi.login({
        email: this.email,
        password: this.password,
      });
      this.auth.setUser({
        id: result.id,
        email: result.email,
        name: result.email.split('@')[0],
        role: this.mapRole(result.role),
      });
      // Route based on role.
      // on the layout route is the single source of truth and bounces
      // unfinished-intake users back to their spot in the conversation.
      if (this.auth.hasAdminRole()) {
        this.router.navigate(['/admin/overview']);
      } else {
        // returnUrl round-trip: when the session-expiry redirect carried the
        // interrupted destination (e.g. /integrations), resume there instead
        // of the default. INTERNAL paths only — '/x...' but not '//x' — so
        // the query param can never become an open redirect.
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        this.error.set(
          'Invalid email or password',
        );
      } else if (err instanceof BadRequestError) {
        this.error.set(
          'Invalid login data',
        );
      } else {
        this.error.set(
          'Something went wrong. Please try again.',
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Preview-only sign-in: set the session locally and go to the authenticated
   * home. An address containing "admin" lands on the admin overview so both
   * shells stay reviewable from the one form.
   */
  private previewSignIn() {
    const isAdmin = /admin/i.test(this.email);
    const name = this.email.split('@')[0];
    this.auth.setUser(
      isAdmin
        ? { id: 'preview-admin', email: this.email, name, role: 'ADMIN' }
        : {
            id: 'preview-user',
            email: this.email,
            name,
            role: 'USER',
          },
    );
    this.router.navigate([isAdmin ? '/admin/overview' : '/dashboard']);
  }

  private mapRole(
    backendRole: string,
  ): 'USER' | 'ADMIN' | 'SUPER_ADMIN' {
    switch (backendRole) {
      case 'ADMIN':
        return 'ADMIN';
      case 'SUPER_ADMIN':
        return 'SUPER_ADMIN';
      default:
        return 'USER';
    }
  }

}
