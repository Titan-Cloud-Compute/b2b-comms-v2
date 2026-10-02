/**
 * Styles for {@link AccountModalComponent}.
 *
 * Extracted verbatim from `account-modal.component.definition.ts` so the
 * component definition stays within the file-size limit. This is a pure
 * structural move — the CSS is unchanged. Referenced from the component's
 * `styles` metadata array.
 */
export const accountModalStyles = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 1000;
    }

    .account-modal {
      background: white;
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 1200px;
      max-height: 90vh;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-lg);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .modal-header h2 {
      font-size: var(--font-size-lg);
      margin: 0;
      color: var(--color-text-primary);
    }

    .close-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      border-radius: var(--radius-btn);
    }

    .close-btn:hover {
      background: var(--color-bg-tertiary);
    }

    .modal-body {
      display: flex;
      align-items: stretch;
      gap: 1.5rem;
      padding: 1.5rem;
    }

    .settings-nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 0 0 200px;
      width: 200px;
      border-right: 1px solid var(--color-border);
      padding-right: 1rem;
    }

    .settings-nav-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0.625rem 0.75rem;
      background: none;
      border: none;
      border-radius: var(--radius-btn);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .settings-nav-item:hover {
      background: var(--color-bg-tertiary);
      color: var(--color-text-primary);
    }

    .settings-nav-item.active {
      background: var(--color-primary);
      color: white;
    }

    .settings-content {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 640px) {
      .modal-body {
        flex-direction: column;
        gap: 1rem;
      }
      .settings-nav {
        flex: 0 0 auto;
        width: 100%;
        flex-direction: row;
        flex-wrap: wrap;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        padding-right: 0;
        padding-bottom: 1rem;
      }
    }

    .account-section {
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .account-section:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .account-section h3 {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--color-primary);
      margin: 0 0 1rem 0;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 0.375rem;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: var(--font-size-input);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-btn);
      min-height: 44px;
      box-sizing: border-box;
      background: white;
      color: var(--color-text-primary);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: var(--shadow-focus);
    }

    .form-input[disabled] {
      background: var(--color-neutral-100);
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }

    .field-note {
      display: block;
      margin-top: 0.35rem;
      font-size: var(--font-size-xs);
      color: var(--color-gray-500);
    }

    .status-msg {
      display: block;
      margin: 0.25rem 0 0.5rem;
      font-size: var(--font-size-sm);
      color: var(--color-success-600);
    }

    .status-msg.error {
      color: var(--color-error-600);
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-btn);
      font-size: var(--font-size-sm);
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: all 0.15s;
    }

    .btn-primary:hover {
      background: var(--color-primary-hover);
    }

    .usage-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .usage-stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem;
      background: var(--color-neutral-100);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-btn);
    }

    .usage-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-primary);
    }

    .usage-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-top: 0.25rem;
      text-align: center;
    }

    .model-list {
      list-style: none;
      margin: 0 0 0.75rem 0;
      padding: 0;
    }

    .model-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid var(--color-neutral-200);
      min-height: 44px;
    }

    .model-item:last-child {
      border-bottom: none;
    }

    .model-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text-primary);
      font-weight: 500;
    }

    .model-badge {
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-pill);
      font-size: var(--font-size-xs);
      font-weight: 600;
      background: var(--color-success-100);
      color: var(--color-success-800);
    }

    .model-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .add-model-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: stretch;
    }

    .add-model-controls select {
      flex: 1;
      min-width: 160px;
    }

    .add-model-controls .btn-primary {
      white-space: nowrap;
      flex-shrink: 0;
    }

    .btn-test {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      background: white;
      color: var(--color-primary);
      border: 1px solid var(--color-on-primary-muted);
      border-radius: var(--radius-btn);
      font-size: var(--font-size-sm);
      font-weight: 600;
      cursor: pointer;
      min-height: 38px;
      transition: all 0.15s;
    }

    .btn-test:hover {
      background: var(--color-primary-light);
    }

    .btn-test:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .terms-gate {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-btn);
      background: var(--color-neutral-50);
    }

    .terms-gate h4 {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
      margin: 0 0 0.5rem 0;
    }

    .terms-agree {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      margin: 0.5rem 0 0.75rem;
      cursor: pointer;
    }

    .terms-agree input {
      margin-top: 0.15rem;
    }
  `;
