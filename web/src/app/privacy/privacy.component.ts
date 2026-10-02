import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="static-page">
      <header class="page-header">
        <div class="header-inner">
          <a routerLink="/login" class="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            Back
          </a>
          <span class="org-label">ENTERPRISE TEMPLATE</span>
        </div>
      </header>

      <main class="page-main">
        <div class="content-card">
          <h1>Privacy Policy</h1>
          <p class="effective-date">Effective date: 1 January 2026</p>

          <section>
            <h2>1. Data Controller</h2>
            <p>
              Example Org acts as the data controller for the Enterprise Platform.
              This policy describes how we collect, use, store, and protect your personal data
              in accordance with applicable data protection law.
            </p>
          </section>

          <section>
            <h2>2. Data We Collect</h2>
            <p>We collect the following categories of data:</p>
            <ul>
              <li>Account data: email address, name, organisation name;</li>
              <li>Usage data: interactions with platform features, timestamps;</li>
              <li>Technical data: IP address, browser type, session tokens (security logging only).</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Data</h2>
            <p>All data is processed for the purposes of operating the platform:</p>
            <ul>
              <li>Providing the service — delivering consulting tools and recommendations (legal basis: performance of contract and explicit consent);</li>
              <li>Platform security — preventing misuse (legal basis: legitimate interest);</li>
              <li>Programme improvement — aggregated, anonymised analysis only.</li>
            </ul>
            <p>The data is never sold, never used for advertising, and never shared with third parties for commercial purposes.</p>
          </section>

          <section>
            <h2>4. Data Retention</h2>
            <p>
              Account data is retained for the duration of your participation in the programme.
              Upon request, we will delete your personal data within 30 days, subject to legal obligations.
            </p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <p>Under applicable data protection law, you have the right to:</p>
            <ul>
              <li>access your personal data;</li>
              <li>request correction or deletion;</li>
              <li>withdraw consent at any time (this will not affect lawfulness of prior processing);</li>
              <li>lodge a complaint with a supervisory authority.</li>
            </ul>
          </section>

          <section>
            <h2>6. Security</h2>
            <p>
              We use industry-standard security measures including encrypted storage, access controls,
              and audit logging. No system is completely secure; we will notify you of any breach
              as required by law.
            </p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>
              For data protection enquiries, contact us at
              <a href="mailto:privacy@example.org">privacy&#64;example.org</a>.
            </p>
          </section>
        </div>
      </main>

      <footer class="page-footer">
        <span>© 2026 Example Org</span>
        <span class="divider">·</span>
        <a routerLink="/privacy">Privacy</a>
        <span class="divider">·</span>
        <a routerLink="/terms">Terms</a>
      </footer>
    </div>
  `,
  styles: [`
    .static-page {
      min-height: 100vh; display: flex; flex-direction: column;
      background: var(--color-neutral-50); font-family: system-ui, -apple-system, sans-serif;
    }
    .page-header { background: var(--color-primary); color: white; padding: 0 2rem; }
    .header-inner {
      max-width: 800px; margin: 0 auto; height: 56px;
      display: flex; align-items: center; gap: 1rem;
    }
    .back-link {
      display: flex; align-items: center; gap: 0.375rem;
      color: rgba(255,255,255,0.85); text-decoration: none; font-size: var(--font-size-sm);
    }
    .back-link:hover { color: white; }
    .org-label {
      font-size: var(--font-size-xs); font-weight: 500; letter-spacing: 0.06em;
      color: rgba(255,255,255,0.7); flex: 1; text-align: center;
    }
    .page-main { flex: 1; padding: 2.5rem 1.5rem; }
    .content-card {
      max-width: 800px; margin: 0 auto; background: white;
      border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 2.5rem 3rem;
    }
    h1 { font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-primary); margin: 0 0 0.5rem; }
    .effective-date { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0 0 2rem; }
    section { margin-bottom: 2rem; }
    h2 {
      font-size: var(--font-size-lg); font-weight: 600; color: var(--color-primary);
      margin: 0 0 0.625rem; padding-bottom: 0.375rem; border-bottom: 1px solid var(--color-neutral-100);
    }
    p { font-size: var(--font-size-md); line-height: 1.7; color: var(--color-gray-700); margin: 0 0 0.75rem; }
    ul { margin: 0.5rem 0 0.75rem 1.25rem; padding: 0; }
    li { font-size: var(--font-size-md); line-height: 1.7; color: var(--color-gray-700); margin-bottom: 0.25rem; }
    a { color: var(--color-info-hover); text-decoration: underline; text-underline-offset: 2px; }
    a:hover { color: var(--color-primary); }
    .page-footer {
      background: white; border-top: 1px solid var(--color-border); padding: 1rem 2rem;
      display: flex; justify-content: center; align-items: center; gap: 0.75rem;
      font-size: var(--font-size-xs); color: var(--color-text-secondary);
    }
    .page-footer a { color: var(--color-text-secondary); text-decoration: none; }
    .page-footer a:hover { color: var(--color-primary); }
    .divider { color: var(--color-border); }
    @media (max-width: 640px) { .content-card { padding: 1.5rem; } h1 { font-size: var(--font-size-xl); } }
  `]
})
export class PrivacyComponent {}
