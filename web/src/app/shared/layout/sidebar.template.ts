export const SIDEBAR_TEMPLATE = `
    <aside class="sidebar" [class.mobile-open]="mobileOpen()">
      <div class="sidebar-header">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" style="fill: var(--color-primary)"/>
            <path d="M14 24L22 32L34 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="logo-text">
          <span class="logo-title">{{ 'Platform' }}</span>
          <span class="logo-subtitle">{{ 'SME Programme' }}</span>
        </div>
      </div>

      @if (auth.hasAdminRole()) {
        <div class="role-banner admin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>{{ 'Admin console' }}</span>
        </div>
      }

      <nav class="sidebar-nav">
        @if (!auth.hasAdminRole()) {
          <div class="nav-group-label">{{ 'Workspace' }}</div>
          @for (item of firmNavItems; track item.label) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{exact: item.path === '/dashboard' || item.path === '/learning'}"
              class="nav-item"
              (click)="navClick.emit()"
            >
              <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
              <span class="nav-label">{{ item.label }}</span>
            </a>
          }
        }

        @if (auth.hasAdminRole()) {
          <div class="nav-group-label">{{ 'Administration' }}</div>
          @for (item of adminNavItems; track item.label) {
            @if (!item.superAdminOnly || auth.isSuperAdmin()) {
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                class="nav-item nav-link"
                (click)="onAdminNavClick(item.label)"
              >
                <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
                <span class="nav-label">{{ item.label }}</span>
              </a>
            }
          }
        }

        <!-- Role-agnostic entries (saved searches): every signed-in user owns
             their own saved searches, so this group renders outside both role
             branches above. -->
        <div class="nav-group-label">{{ 'Personal' }}</div>
        @for (item of sharedNavItems; track item.label) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            class="nav-item"
            (click)="navClick.emit()"
          >
            <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="sidebar-footer">

        <button class="settings-link" (click)="onSettingsClick()">
          {{ 'Account Settings' }}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
          </svg>
        </button>

        <div class="user-card-row">
          <div class="user-row">
            <div class="avatar">
              <span>{{ initials() }}</span>
            </div>
            <div class="user-details">
              <span class="user-name">{{ displayName() }}</span>
              <span class="user-role">{{ roleLabel() }}</span>
            </div>
          </div>
          <div class="user-actions">
            <button
              class="logout-btn"
              (click)="logout()"
              [attr.aria-label]="'Sign out'"
              [attr.title]="'Sign out'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  `;
