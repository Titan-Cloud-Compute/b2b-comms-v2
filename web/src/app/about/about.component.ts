import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StickyFooterComponent } from '../shared/sticky-footer.component';

/**
 * Public "About this platform" page. Holds the brand heading, tagline and the
 * four-step journey that used to sit in the blue panel beside the sign-in form
 * (feedback: the copy competed with the only action on #/login). Same class as
 * terms/privacy: public, no API call, no user data.
 */
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, StickyFooterComponent],
  template: `
    <div class="about-page">
      <div class="brand-panel">
        <div class="brand-content">
          <p class="brand-eyebrow">{{ 'Enterprise Template' }}</p>
          <h1 class="brand-title">{{ 'Enterprise' }}<br>{{ 'Platform' }}</h1>
          <p class="brand-tagline">{{ 'An enterprise application platform.' }}</p>
          <ol class="journey">
            @for (step of journey; track step.key) {
              <li class="journey-item">
                <span class="journey-num">{{ $index + 1 }}</span>
                <span class="journey-text">
                  <span class="journey-title">{{ step.en }}</span>
                  <span class="journey-desc">{{ step.enDesc }}</span>
                </span>
              </li>
            }
          </ol>

          <a routerLink="/login" class="signin-link">
            {{ 'Go to sign in' }}
          </a>
        </div>
      </div>

      <app-sticky-footer></app-sticky-footer>
    </div>
  `,
  styles: [`
    .about-page {
      min-height: 100svh;
      display: flex;
      flex-direction: column;
    }

    .brand-panel {
      flex: 1;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
      display: flex;
      flex-direction: column;
      padding: 3rem 2rem;
      color: white;
    }

    .brand-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1;
      width: 100%;
      max-width: 40rem;
      margin: 0 auto;
    }

    .brand-eyebrow {
      font-size: var(--font-size-sm);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-on-primary-muted);
      margin: 0 0 0.75rem;
    }

    .brand-title {
      font-family: var(--font-display);
      font-size: var(--font-size-2xl);
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 1rem;
      color: white;
    }

    .brand-tagline {
      font-size: var(--font-size-lg);
      line-height: 1.5;
      color: var(--color-on-primary-soft);
      max-width: 28rem;
      margin: 0 0 2rem;
    }

    .journey {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
      max-width: 28rem;
    }

    .journey-item {
      display: flex;
      gap: 0.9rem;
      align-items: flex-start;
    }

    .journey-num {
      flex: 0 0 auto;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--radius-circle);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: var(--font-size-sm);
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.28);
      color: var(--color-white);
    }

    .journey-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .journey-title {
      font-weight: 600;
      color: var(--color-white);
    }

    .journey-desc {
      font-size: var(--font-size-sm);
      line-height: 1.4;
      color: var(--color-on-primary-muted);
    }

    .signin-link {
      align-self: flex-start;
      margin-top: 2rem;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius-btn);
      border: 1px solid rgba(255, 255, 255, 0.4);
      color: var(--color-white);
      font-size: var(--font-size-md);
      font-weight: 600;
      text-decoration: none;
    }

    .signin-link:hover {
      background: rgba(255, 255, 255, 0.14);
    }

    @media (max-width: 768px) {
      .brand-panel { padding: 2rem 1.5rem; }
      .brand-title { font-size: var(--font-size-xl); }
    }
  `]
})
export class AboutComponent {
  /** Product journey steps. */
  readonly journey = [
    { key: 'onboard', en: 'Get started', enDesc: 'Set up your account in minutes.' },
    { key: 'configure', en: 'Configure', enDesc: 'Tailor the platform to your organization.' },
    { key: 'operate', en: 'Operate', enDesc: 'Manage your team and data in one place.' },
    { key: 'analyze', en: 'Analyze', enDesc: 'Review activity and make informed decisions.' },
  ];
}
