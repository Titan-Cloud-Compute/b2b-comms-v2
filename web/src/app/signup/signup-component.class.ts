import { Component, signal, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../shared/auth.service';
import { AuthApi } from '../shared/api/auth-api.service';
import {
  SIGNUP_MODEL_FIELD_TEMPLATE,
  SIGNUP_TOKEN_FIELD_TEMPLATE,
} from './signup-model-field.template';
import { TokenModelResolver } from './signup-admin-model';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './signup.component.css',
  template: `
    <div class="signup-container">
      <div class="signup-card">
        <div class="logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" style="fill: var(--color-primary)"/>
            <path d="M14 24L22 32L34 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>Create Account</h1>
        <p class="subtitle">Join the Enterprise Platform</p>

        <form (ngSubmit)="onSignup()" class="signup-form">
          @if (error()) {
            <div class="error-message">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              {{ error() }}
            </div>
          }

          @if (currentStep() === 1) {
          ${SIGNUP_TOKEN_FIELD_TEMPLATE}
          }

          ${SIGNUP_MODEL_FIELD_TEMPLATE}


          @if (currentStep() === 2) {
          <div class="form-group">
            <label for="email">Email *</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              name="email"
              placeholder="email@company.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password">Password *</label>
            <div class="password-row">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                id="password"
                [(ngModel)]="password"
                name="password"
                placeholder="Min 8 characters"
                required
                autocomplete="new-password"
              />
              <button
                type="button"
                class="password-toggle"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
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
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password *</label>
            <div class="password-row">
              <input
                [type]="showConfirmPassword() ? 'text' : 'password'"
                id="confirmPassword"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                placeholder="Repeat password"
                required
                autocomplete="new-password"
              />
              <button
                type="button"
                class="password-toggle"
                (click)="showConfirmPassword.set(!showConfirmPassword())"
                [attr.aria-label]="showConfirmPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showConfirmPassword()"
              >
                @if (showConfirmPassword()) {
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
          </div>
          }

          <div class="step-indicator">
            <span class="step-badge">Step {{ currentStep() }} of 2</span>
          </div>

          <div class="step-nav">
            @if (currentStep() > 1) {
              <button type="button" class="btn-secondary" (click)="prevStep()" [disabled]="isLoading()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back
              </button>
            }
            @if (currentStep() < 2) {
              <button type="button" class="btn-primary" (click)="nextStep()">
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            } @else {
              <button type="submit" class="btn-primary" [disabled]="isLoading()">
                @if (isLoading()) {
                  <span class="spinner"></span>
                  Continuing...
                } @else {
                  Continue to Consent
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                }
              </button>
            }
          </div>
        </form>

        <div class="divider">
          <span>or</span>
        </div>

        <p class="login-link">
          Already have an account?
          <a routerLink="/login">Sign in</a>
        </p>
      </div>

      <footer class="signup-footer">
        <p>Enterprise Template</p>
      </footer>
    </div>
  `
})
export class SignupComponent implements OnInit, OnDestroy {
  signupToken = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = signal<string | null>(null);
  isLoading = signal(false);
  currentStep = signal(1);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  tokenModelLabel = signal<string>('');
  selectedModel = '';

  auth = inject(AuthService);
  private authApi = inject(AuthApi);

  private route = inject(ActivatedRoute);
  private routeSub?: Subscription;
  private tokenModel = new TokenModelResolver(
    this.authApi,
    this.tokenModelLabel,
    (modelId) => this.onModelChange(modelId),
  );

  constructor(private router: Router) {}

  onTokenChange(raw: string) {
    this.signupToken = raw ?? '';
    this.tokenModel.onTokenChange(this.signupToken);
  }

  ngOnInit() {
    this.restoreStagedSignup();

    this.routeSub = this.route.paramMap.subscribe((pm) => {
      const n = Number(pm.get('step'));
      this.currentStep.set(n === 2 ? 2 : 1);
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.tokenModel.cancel();
  }

  onModelChange(modelId: string) {
    this.selectedModel = modelId;
    try {
      localStorage.setItem('preferredChatModel', modelId);
    } catch {
      // localStorage may be unavailable
    }
  }

  nextStep() {
    this.error.set(null);

    if (this.currentStep() === 1) {
      if (!this.signupToken || this.signupToken.trim().length === 0) {
        this.error.set('Please enter a registration token');
        return;
      }

      const tokenRegex = /^[a-fA-F0-9]{48}$/;
      if (!tokenRegex.test(this.signupToken.trim())) {
        this.error.set('Invalid token format. Must be 48 hexadecimal characters.');
        return;
      }

      void this.router.navigate(['/signup', 2]);
    }
  }

  prevStep() {
    this.error.set(null);
    if (this.currentStep() > 1) {
      void this.router.navigate(['/signup', this.currentStep() - 1]);
    }
  }

  async onSignup() {
    if (this.currentStep() < 2) {
      this.nextStep();
      return;
    }

    this.error.set(null);

    if (!this.signupToken || this.signupToken.trim().length === 0) {
      this.error.set('Please enter a registration token');
      return;
    }

    const tokenRegex = /^[a-fA-F0-9]{48}$/;
    if (!tokenRegex.test(this.signupToken.trim())) {
      this.error.set('Invalid token format. Must be 48 hexadecimal characters.');
      return;
    }

    if (!this.email || !this.password || !this.confirmPassword) {
      this.error.set('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(this.email.trim())) {
      this.error.set('Please enter a valid email address');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    this.isLoading.set(true);

    try {
      this.stageSignup();
      void this.router.navigate(['/consent']);
    } catch {
      this.error.set('Signup failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private stageSignup() {
    const staged = {
      signupToken: this.signupToken.trim(),
      email: this.email.trim(),
      selectedModel: this.selectedModel,
    };
    localStorage.setItem('pendingSignup', JSON.stringify(staged));
    try {
      sessionStorage.setItem('pendingSignupPassword', this.password);
    } catch {
      // sessionStorage may be unavailable
    }
  }

  private restoreStagedSignup() {
    let staged: any = null;
    try {
      const raw = localStorage.getItem('pendingSignup');
      staged = raw ? JSON.parse(raw) : null;
    } catch {
      staged = null;
    }
    if (!staged || typeof staged !== 'object') return;

    this.email = staged.email ?? '';
    if (staged.selectedModel) this.selectedModel = staged.selectedModel;

    try {
      const pw = sessionStorage.getItem('pendingSignupPassword') ?? '';
      this.password = pw;
      this.confirmPassword = pw;
    } catch {
      // Ignore
    }

    if (staged.signupToken) this.onTokenChange(String(staged.signupToken));
  }
}
