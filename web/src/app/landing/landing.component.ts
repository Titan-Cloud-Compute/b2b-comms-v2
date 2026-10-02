import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="landing-page">
      <div class="landing-hero">
        <div class="landing-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" style="fill: var(--color-primary, #4f46e5)"/>
            <path d="M14 24L22 32L34 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="landing-title">Enterprise Platform</h1>
        <p class="landing-subtitle">A modern platform for your organization.</p>
        <div class="landing-actions">
          <a routerLink="/login" class="btn-signin">Sign In</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .landing-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-secondary, #f8fafc);
    }
    .landing-hero {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    .landing-logo {
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: center;
    }
    .landing-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-text-primary, #0f172a);
      margin: 0 0 0.75rem;
    }
    .landing-subtitle {
      color: var(--color-text-secondary, #64748b);
      font-size: 1.125rem;
      margin: 0 0 2rem;
    }
    .landing-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn-signin {
      display: inline-flex;
      align-items: center;
      padding: 0.75rem 2rem;
      background: var(--color-primary, #4f46e5);
      color: #fff;
      border-radius: var(--radius-btn, 0.5rem);
      font-weight: 600;
      text-decoration: none;
      font-size: 1rem;
    }
    .btn-signin:hover {
      background: var(--color-primary-hover, #4338ca);
    }
  `]
})
export class LandingComponent {}
