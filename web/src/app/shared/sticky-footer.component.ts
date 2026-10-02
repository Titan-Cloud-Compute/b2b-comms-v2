import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-sticky-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="sticky-footer">
      <div class="footer-content">
        <a routerLink="/privacy" class="footer-link">{{ 'Privacy' }}</a>
        <span class="divider">·</span>
        <a routerLink="/terms" class="footer-link">{{ 'Terms' }}</a>
      </div>
      <span data-probe="single-manifest-e2e" class="probe-hidden" aria-hidden="true">probe</span>
    </footer>
  `,
  styles: [`
    .sticky-footer {
      padding: 1rem 2rem;
      background: white;
      border-top: 1px solid var(--color-border);
      text-align: center;
    }

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .probe-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .divider {
      color: var(--color-border);
    }

    .footer-link {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: color 0.15s;
    }

    .footer-link:hover {
      color: var(--color-primary);
    }
  `]
})
export class StickyFooterComponent {
  auth = inject(AuthService);
}
