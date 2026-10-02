import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dashboard-page" data-placeholder>
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Welcome to the platform.</p>
      </header>
      <div class="placeholder-card">
        <p class="placeholder-text">Your content will appear here.</p>
        <form class="placeholder-form" (ngSubmit)="$event.preventDefault()">
          <div class="form-group">
            <label for="ph-field-1">Field 1</label>
            <input type="text" id="ph-field-1" [(ngModel)]="field1" name="field1" placeholder="Enter value…" />
          </div>
          <div class="form-group">
            <label for="ph-field-2">Field 2</label>
            <input type="text" id="ph-field-2" [(ngModel)]="field2" name="field2" placeholder="Enter value…" />
          </div>
          <button type="submit" class="btn-primary" disabled>Submit</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .page-header {
      margin-bottom: 2rem;
    }
    h1 {
      font-size: var(--font-size-xl);
      color: var(--color-text-primary);
      margin: 0 0 0.25rem;
    }
    .subtitle {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin: 0;
    }
    .placeholder-card {
      background: white;
      border-radius: var(--radius-card);
      border: 1px solid var(--color-border);
      padding: 2rem;
    }
    .placeholder-text {
      color: var(--color-text-secondary);
      margin: 0 0 1.5rem;
    }
    .placeholder-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .form-group label {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .form-group input {
      padding: 0.625rem 0.75rem;
      font-size: var(--font-size-input, 1rem);
      border: 1px solid var(--color-gray-300);
      border-radius: var(--radius-btn);
      background: white;
      min-height: 44px;
    }
    .btn-primary {
      align-self: flex-start;
      padding: 0.625rem 1.5rem;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: white;
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-btn);
      cursor: not-allowed;
      opacity: 0.6;
      min-height: 44px;
    }
  `]
})
export class DashboardComponent {
  field1 = '';
  field2 = '';
}
