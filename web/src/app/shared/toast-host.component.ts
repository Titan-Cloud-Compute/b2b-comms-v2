import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './api/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast-' + t.level" role="status">
          <span class="toast-message">{{ t.message }}</span>
          @if (t.retry) {
            <button
              type="button"
              class="toast-action"
              (click)="onRetry(t.id)"
            >Retry</button>
          }
          <button
            type="button"
            class="toast-dismiss"
            aria-label="Dismiss"
            (click)="toast.dismiss(t.id)"
          >×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1rem;
      right: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 9999;
      max-width: min(420px, calc(100vw - 2rem));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--color-surface, var(--color-white));
      border: 1px solid var(--color-border, var(--color-border));
      border-radius: var(--radius-md, 10px);
      box-shadow: var(--shadow-md);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary, var(--color-text-primary));
      animation: toast-in 180ms ease-out;
    }
    .toast-message { flex: 1; }
    .toast-info    { border-left: 4px solid var(--color-primary, var(--color-primary)); }
    .toast-success { border-left: 4px solid var(--color-success, var(--color-success)); }
    .toast-warning { border-left: 4px solid var(--color-warning, var(--color-warning)); background: var(--color-warning-bg, var(--color-warning-bg)); }
    .toast-error   { border-left: 4px solid var(--color-error, var(--color-error)); background: var(--color-error-bg, var(--color-error-bg)); }
    .toast-action {
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-sm, 6px);
      border: 1px solid var(--color-border, var(--color-border));
      background: var(--color-bg-primary, var(--color-white));
      color: var(--color-primary, var(--color-primary));
      font-weight: 600;
      cursor: pointer;
    }
    .toast-action:hover { background: var(--color-primary-light, var(--color-primary-light)); }
    .toast-dismiss {
      background: none;
      border: none;
      color: var(--color-text-tertiary, var(--color-text-tertiary));
      font-size: var(--font-size-xl);
      line-height: 1;
      cursor: pointer;
      padding: 0 0.25rem;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ToastHostComponent {
  toast = inject(ToastService);

  onRetry(id: number) {
    this.toast.dismiss(id);
    // The interceptor's retry CTA reloads the page so any open
    // resources re-fetch fresh data. Components with manual reload()
    // can listen to the toast service if they want finer control.
    location.reload();
  }
}
