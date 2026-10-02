import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { SafeHtmlPipe } from '../safe-html.pipe';
import { AuthApi } from '../api/auth-api.service';
import { FIRM_NAV_ITEMS, ADMIN_NAV_ITEMS, SHARED_NAV_ITEMS, ADMIN_TAB_MAP } from './nav-items';
import { SIDEBAR_TEMPLATE } from './sidebar.template';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, SafeHtmlPipe],
  template: SIDEBAR_TEMPLATE,
  styles: [`
    .sidebar {
      width: 260px;
      background: white;
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      position: fixed;
      /* Shift below the global impersonation banner when present (--imp-h is set
         on :root by the layout while "viewing as company"; 0 otherwise). */
      top: var(--imp-h, 0px);
      left: 0;
      bottom: 0;
      z-index: 200;
      box-shadow: var(--shadow-sidebar);
    }

    .sidebar-header {
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid var(--color-border);
    }

    .logo-text {
      display: flex;
      flex-direction: column;
    }

    .logo-title {
      font-weight: 700;
      color: var(--color-text-primary);
      font-size: var(--font-size-lg);
    }

    .logo-subtitle {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
    }

    .role-banner {
      margin: 0.75rem 1rem 0;
      padding: 0.4rem 0.625rem;
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.05em;
      border-radius: var(--radius-btn);
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      width: fit-content;
    }

    .role-banner.admin {
      background: var(--color-primary-light);
      color: var(--color-primary);
      border: 1px solid var(--color-on-primary-muted);
    }

    .sidebar-nav {
      flex: 1;
      padding: 0.5rem 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      overflow-y: auto;
      overscroll-behavior-y: contain;
    }

    .nav-group-label {
      font-size: var(--font-size-xs);
      font-weight: 700;
      color: var(--color-text-secondary);
      letter-spacing: 0.08em;
      padding: 0.875rem 1rem 0.375rem;
      text-transform: uppercase;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      color: var(--color-text-secondary);
      font-size: var(--font-size-md);
      font-weight: 500;
      transition: all 0.15s;
      min-height: 44px;
      text-decoration: none;
    }

    .nav-item:hover {
      background: var(--color-bg-tertiary);
      color: var(--color-text-primary);
    }

    .nav-item:active {
      transform: scale(0.98);
    }

    .nav-item.active {
      background: var(--color-primary-light);
      color: var(--color-primary);
      border-left: 3px solid var(--color-primary);
    }

    .nav-item.nav-link {
      width: 100%;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
      background: none;
    }

    /* Secondary, always-English label rendered next to a localized nav label
       so entries like "Need Help?" stay findable while
       the UI language differs. */
    .nav-label-alt {
      opacity: 0.65;
      font-size: var(--font-size-sm);
      white-space: nowrap;
    }

    .nav-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .sidebar-footer {
      padding: 0.875rem 1.25rem;
      border-top: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .lang-toggle-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .lang-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .lang-toggle {
      display: flex;
      gap: 0.25rem;
      background: var(--color-bg-tertiary);
      padding: 3px;
      border-radius: var(--radius-btn);
    }

    .lang-btn {
      padding: 0.375rem 0.625rem;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
      min-height: 32px;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .lang-btn:hover {
      color: var(--color-text-primary);
      background: var(--color-border);
    }

    .lang-btn:active {
      transform: scale(0.95);
    }

    .lang-btn.active {
      background: white;
      color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }

    .lang-btn:disabled {
      cursor: default;
      opacity: 0.6;
    }

    .lang-btn:disabled:hover {
      color: var(--color-text-secondary);
      background: transparent;
    }

    .lang-btn.active:disabled:hover {
      background: white;
      color: var(--color-primary);
    }

    .settings-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s;
      min-height: 44px;
      text-align: left;
    }

    .settings-link:hover {
      background: var(--color-primary-light);
      color: var(--color-primary);
      border-color: var(--color-on-primary-muted);
    }

    .settings-link:active {
      transform: scale(0.98);
    }

    .settings-link svg {
      flex-shrink: 0;
    }

    .user-card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-wrap: nowrap;
      flex: 1;
      min-width: 0;
    }

    .user-actions {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: var(--font-size-sm);
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .user-name {
      font-weight: 600;
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }

    .user-role {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      letter-spacing: 0.04em;
    }

    .logout-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-neutral-400);
      border-radius: var(--radius-btn);
      transition: all 0.15s;
      flex-shrink: 0;
      margin-left: auto;
    }

    .logout-btn:hover {
      background: var(--color-error-100);
      color: var(--color-error-600);
    }

    .switch-roles-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      margin-top: 0.625rem;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-light);
      border: 1px solid var(--color-on-primary-muted);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      min-height: 40px;
    }

    .switch-roles-link:hover {
      background: var(--color-primary-border-soft);
      border-color: var(--color-on-primary-faint);
    }

    .switch-roles-link:active {
      transform: scale(0.98);
    }

    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        transition: transform 0.3s ease;
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }
    }
  `]
})
export class SidebarComponent {
  mobileOpen = input<boolean>(false);
  /** Emitted when a nav link is clicked (signals layout to close mobile menu) */
  navClick = output<void>();
  /** Emitted when Account Settings button is clicked */
  openSettings = output<void>();

  readonly firmNavItems = FIRM_NAV_ITEMS;
  readonly adminNavItems = ADMIN_NAV_ITEMS;
  // Rendered for every role (see SHARED_NAV_ITEMS) — outside the role branches.
  readonly sharedNavItems = SHARED_NAV_ITEMS;

  auth = inject(AuthService);
  private router = inject(Router);
  private authApi = inject(AuthApi);

  initials = computed(() => {
    const name = this.auth.user()?.name || 'U U';
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  displayName = computed(() => {
    const u = this.auth.user();
    return u?.firmName || u?.name || 'User';
  });

  roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    if (role === 'ADMIN') return 'ADMIN';
    return 'User';
  });

  onAdminNavClick(label: string) {
    this.auth.setAdminTab(ADMIN_TAB_MAP[label] || 'overview');
    this.navClick.emit();
  }

  onSettingsClick() {
    this.openSettings.emit();
    this.navClick.emit();
  }

  async logout() {
    this.navClick.emit();
    try {
      await this.authApi.logout();
    } catch {
      /* ignore — clear local state regardless */
    }
    this.auth.signOut();
    this.router.navigate(['/login']);
  }
}
