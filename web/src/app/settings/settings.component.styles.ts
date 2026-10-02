/** Extracted inline styles for {@link SettingsComponent}. Moved verbatim out of
 *  settings.component.ts (which exceeded the 500-line module limit). Pure structural
 *  move — the CSS is unchanged. */
export const settingsComponentStyles = `
    :host { display: block; padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; }
    h1 { color: var(--color-text-primary); margin-bottom: 0.375rem; }
    .muted { color: var(--color-text-secondary); margin: 0; }
    .settings-tabs {
      display: flex; gap: 0.25rem; flex-wrap: wrap;
      border-bottom: 1px solid var(--color-border); margin-bottom: 1.25rem;
    }
    .settings-tab {
      min-height: 44px; padding: 0.625rem 1.125rem; cursor: pointer;
      background: transparent; border: none; border-bottom: 2px solid transparent;
      color: var(--color-text-secondary); font-weight: 600; font-size: var(--font-size-md);
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    }
    .settings-tab:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
    .settings-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
    .settings-grid {
      display: grid; gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }
    .card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.5rem;
      box-shadow: var(--shadow-sm);
    }
    .card h2 {
      display: flex; align-items: center; gap: 0.625rem;
      color: var(--color-text-primary); font-size: var(--font-size-lg); margin-bottom: 1rem;
    }
    .badge {
      padding: 0.25rem 0.625rem; border-radius: var(--radius-pill);
      font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase;
    }
    .badge.ok { background: var(--color-success-bg); color: var(--color-success); }
    .badge.warn { background: var(--color-warning-bg); color: var(--color-warning); }
    .badge.error { background: var(--color-error-bg); color: var(--color-error); }
    .badge.neutral { background: var(--color-bg-secondary); color: var(--color-text-secondary); }
    /* Per-model API-key liveness status card variants. */
    .badge.key-status { display: inline-flex; align-items: center; gap: 0.25rem; }
    .badge.key-status::before {
      content: ''; width: 0.5rem; height: 0.5rem; border-radius: var(--radius-pill);
      background: currentColor; flex-shrink: 0;
    }
    .badge.key-status.neutral::before { opacity: 0.5; }
    .row { margin-bottom: 0.875rem; display: flex; flex-direction: column; gap: 0.375rem; }
    label { color: var(--color-text-secondary); font-size: var(--font-size-sm); font-weight: 600; }
    input[type=text], input[type=email], select {
      min-height: 44px; padding: 0.5rem 0.75rem;
      background: var(--color-bg-secondary); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-primary);
      font-size: var(--font-size-input); width: 100%;
    }
    .btn {
      min-height: 44px; padding: 0.625rem 1.25rem;
      border-radius: var(--radius-sm); cursor: pointer; font-weight: 600;
      border: 1px solid transparent;
    }
    .btn-primary { background: var(--color-primary); color: var(--color-white); }
    .btn-primary:hover { background: var(--color-primary-hover); }
    .btn-danger { background: var(--color-error); color: var(--color-white); }
    .btn-ghost { background: transparent; border-color: var(--color-border); color: var(--color-text-primary); }
    .consent-meta { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 1rem; }
    .consent-meta dt { color: var(--color-text-tertiary); font-size: var(--font-size-sm); }
    .consent-meta dd { color: var(--color-text-primary); margin: 0.125rem 0 0; font-weight: 500; }
    .scope-pill {
      display: inline-block; padding: 0.125rem 0.625rem; margin-right: 0.25rem;
      background: var(--color-primary-light); color: var(--color-primary);
      border-radius: var(--radius-pill); font-size: var(--font-size-xs); font-weight: 600;
    }
    .hint { color: var(--color-text-tertiary); font-size: var(--font-size-sm); margin-top: 0.5rem; }
    .toggle-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);
      min-height: 44px;
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-row input { width: 20px; height: 20px; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(14, 23, 38, 0.6);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
      padding: 1rem;
    }
    .modal-dialog {
      background: var(--color-surface); border-radius: var(--radius-md);
      padding: 1.5rem; max-width: 480px; width: 100%;
      box-shadow: var(--shadow-lg);
    }
    .modal-dialog h3 { color: var(--color-text-primary); margin-bottom: 0.5rem; }
    .modal-dialog p { color: var(--color-text-secondary); margin-bottom: 1.25rem; }
    .modal-actions {
      display: flex; gap: 0.625rem; justify-content: flex-end; flex-wrap: wrap;
    }
    .modal-dialog input[type=password] {
      min-height: 44px; padding: 0.5rem 0.75rem; width: 100%;
      background: var(--color-bg-secondary); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: var(--font-size-input);
    }
    .masked-key {
      font-family: 'SF Mono','Monaco','Inconsolata','Fira Code',monospace;
      padding: 0.5rem 0.75rem; background: var(--color-bg-secondary);
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      color: var(--color-text-primary); word-break: break-all;
    }
    .empty-models { margin-bottom: 1rem; }
    .model-list { list-style: none; margin: 0 0 1rem; padding: 0; }
    .model-item {
      display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
      padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);
      min-height: 44px;
    }
    .model-item:last-child { border-bottom: none; }
    .model-name {
      display: flex; align-items: center; gap: 0.5rem;
      color: var(--color-text-primary); font-weight: 500;
    }
    .model-actions { display: flex; gap: 0.375rem; flex-shrink: 0; }
    .btn-sm { min-height: 36px; padding: 0.375rem 0.75rem; font-size: var(--font-size-sm); }
    .btn-danger-text { color: var(--color-error); }
    .add-model-row { margin-bottom: 0; }
    .add-model-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: stretch; }
    .add-model-controls select { flex: 1; min-width: 160px; }
    .add-model-controls input {
      flex: 1; min-width: 160px; min-height: 44px; padding: 0.5rem 0.75rem;
      background: var(--color-bg-secondary); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: var(--font-size-input);
    }
    .add-model-controls .btn { white-space: nowrap; flex-shrink: 0; }
`;
