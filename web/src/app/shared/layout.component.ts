import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { AuthService } from './auth.service';
import { SafeHtmlPipe } from './safe-html.pipe';
import { AuthApi } from './api/auth-api.service';
import { SidebarComponent } from './layout/sidebar.component';
import { AccountModalComponent } from './layout/account-modal.component';
import { NavItem, FIRM_NAV_ITEMS, ADMIN_NAV_ITEMS, SHARED_NAV_ITEMS, ADMIN_TAB_MAP } from './layout/nav-items';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SafeHtmlPipe,
    SidebarComponent,
    AccountModalComponent,
  ],
  template: `
    <!-- Read-only "view as company" impersonation banner — a FIXED full-width
         top bar (NOT a flex child of .layout, or it would displace the fixed
         sidebar). The shell is shifted down by --imp-h to clear it. -->
    @if (auth.impersonatingFirm(); as firm) {
      <div class="impersonation-banner">
        <span class="imp-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          {{ 'Viewing as' }}
          <strong>{{ firm }}</strong>
          · {{ 'read-only' }}
        </span>
        <button type="button" class="imp-exit" (click)="exitImpersonation()">
          {{ 'Exit' }}
        </button>
      </div>
    }
    <div class="layout">
      <!-- Mobile Header -->
      <header class="mobile-header">
        <button class="menu-btn" (click)="toggleMobileMenu()" aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            @if (mobileMenuOpen()) {
              <path d="M6 18L18 6M6 6l12 12"/>
            } @else {
              <path d="M3 12h18M3 6h18M3 18h18"/>
            }
          </svg>
        </button>
        <span class="header-title">{{ headerTitle() }}</span>
      </header>

      <!-- Sidebar -->
      <app-sidebar
        [mobileOpen]="mobileMenuOpen()"
        (navClick)="closeMobileMenu()"
        (openSettings)="openAccountModal()"
      />

      <!-- Mobile Overlay -->
      @if (mobileMenuOpen()) {
        <div class="mobile-overlay" (click)="closeMobileMenu()"></div>
      }

      <!-- Main Content -->
      <main class="main-content">
        <!-- The routed page lives in a wrapper that carries this component's
             style-encapsulation attribute, so the shell can actually give it
             the leftover vertical space (a rule targeting the routed host
             directly can never match — it has no _ngcontent attribute). -->
        <div class="routed-area" [class.routed-area-fit]="routedAreaFits()">
          <router-outlet />
        </div>
      </main>

      <!-- Account Modal -->
      @if (showAccountModal()) {
        <app-account-modal (closed)="closeAccountModal()" />
      }

      <!-- Mobile Bottom Nav -->
      <nav class="mobile-bottom-nav">
        @for (item of bottomNavItems(); track $index) {
          @if (!auth.hasAdminRole()) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{exact: true}"
              class="bottom-nav-item"
            >
              <span class="bottom-nav-icon" [innerHTML]="item.icon | safeHtml"></span>
              <span class="bottom-nav-label">{{ item.label }}</span>
            </a>
          } @else {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              class="bottom-nav-item"
              (click)="setAdminTab(item.label)"
            >
              <span class="bottom-nav-icon" [innerHTML]="item.icon | safeHtml"></span>
              <span class="bottom-nav-label">{{ item.label }}</span>
            </a>
          }
        }
      </nav>
    </div>
  `,
  styles: [`
    /* Fixed full-width top bar; the app shell is shifted down by --imp-h so the
       fixed sidebar and main scroll region clear it (the var inherits through
       the DOM, so both this component and the sidebar read the same offset). */
    .impersonation-banner { position: fixed; top: 0; left: 0; right: 0; min-height: 40px; z-index: 400; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.5rem 1rem; background: var(--color-warning-900); color: var(--color-white); font-size: var(--font-size-sm); flex-wrap: wrap; }
    .impersonation-banner .imp-text { display: inline-flex; align-items: center; gap: 0.4rem; }
    .impersonation-banner strong { font-weight: 700; }
    .impersonation-banner .imp-exit { padding: 0.3rem 0.9rem; background: var(--color-white); color: var(--color-warning-900); border: none; border-radius: var(--radius-sm); font-size: var(--font-size-sm); font-weight: 700; cursor: pointer; }
    .impersonation-banner .imp-exit:hover { background: var(--color-error-bg); }
    .layout {
      display: flex;
      margin-top: var(--imp-h, 0px);
      min-height: calc(100vh - var(--imp-h, 0px));
      background: var(--color-bg-secondary);
    }

    /* Mobile Header */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: white;
      border-bottom: 1px solid var(--color-border);
      padding: 0 1rem;
      align-items: center;
      z-index: 100;
      box-shadow: var(--shadow-nav);
    }

    .menu-btn {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-primary);
      border-radius: var(--radius-btn);
    }

    .menu-btn:active { background: var(--color-bg-tertiary); }

    .header-title {
      font-weight: 600;
      color: var(--color-text-primary);
      font-size: var(--font-size-lg);
      flex: 1;
      text-align: center;
    }

    .mobile-lang-toggle {
      display: flex;
      gap: 0.125rem;
      background: var(--color-bg-tertiary);
      padding: 2px;
      border-radius: var(--radius-sm);
    }

    .mobile-lang-btn {
      padding: 0.25rem 0.5rem;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: all 0.15s;
      min-height: 28px;
    }

    .mobile-lang-btn.active {
      background: white;
      color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }

    /* Main Content */
    .main-content {
      flex: 1;
      margin-left: 260px;
      padding: 0;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior-y: contain;
      height: calc(100vh - var(--imp-h, 0px));
      /* Flex column so the shell — not each page — owns vertical space:
         routed content flexes into the space left over, and chrome (the
         support footer) keeps its intrinsic height. Pages whose :host is
         "height:100%; overflow-y:auto" (integrations, documents, curriculum)
         otherwise consume the full 100vh and push the footer out of reach. */
      display: flex;
      flex-direction: column;
    }

    .main-content > * { min-height: 0; }

    /* The routed page absorbs the remaining space so short pages still paint
       their background down to the footer (grow, never shrink — tall pages keep
       their intrinsic height and .main-content scrolls instead of clipping). */
    .routed-area {
      flex: 1 0 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* Opt-in for routes that own their own internal scrolling (chat): they must
       fit the shell exactly, never grow past it. Allowing shrink here is what
       lets the chat message list clamp to the viewport so the composer stays
       visible without scrolling the page. */
    .routed-area.routed-area-fit {
      flex: 1 1 auto;
      overflow: hidden;
    }

    /* The routed component is injected as a sibling of <router-outlet> inside
       .routed-area and never receives this component's _ngcontent attribute,
       so ::ng-deep is required for the rule to reach it. */
    :host ::ng-deep .routed-area > *:not(router-outlet) { flex: 1 0 auto; min-height: 0; }

    /* The chat page is the one route that must never grow past the shell: it
       scrolls its own message list, and any extra intrinsic height pushes the
       composer below the fold. A zero flex-basis (plus min-height: 0) keeps its
       conversation height out of .routed-area's content size, so the column
       stays viewport-bounded and the page itself never scrolls. Same
       specificity as the rule above, so source order wins — scoped to app-chat
       only, leaving every other route's grow-never-shrink behaviour intact. */
    :host ::ng-deep .routed-area > app-chat { flex: 1 1 0; min-height: 0; max-height: 100%; overflow: hidden; }

    /* Same treatment for the admin shell, but ONLY on the research-chat route
       (that is the only admin tab .routed-area-fit is set for). Without it the
       generic "flex: 1 0 auto" rule above lets the admin page keep its
       intrinsic height and the whole page scrolls behind the chat pane. */
    :host ::ng-deep .routed-area.routed-area-fit > app-admin { flex: 1 1 0; min-height: 0; max-height: 100%; overflow: hidden; }

    /* The diagnostic pages own their own internal scrolling too (each tab
       section scrolls inside itself), so they must FIT the shell exactly rather
       than keep their intrinsic height: a tall tab (e.g. the 3000px Growth Plan
       or the Financial Calculations list) would otherwise scroll the whole
       shell and push the page bottom past the support footer. Zero flex-basis
       keeps the section height out of .routed-area's content size, so the
       container ends just above the footer. BOTH diagnostic route components
       are listed here — the tabbed page (app-diagnostic) and the separate
       Financial Calculations route (app-diagnostic-economics), which shares the
       same .diagnostic-layout / .diagnostic-main / .strategy-section styles and
       needs the same clamp for its card to scroll internally. */
    :host ::ng-deep .routed-area > app-diagnostic,
    :host ::ng-deep .routed-area > app-diagnostic-economics { flex: 1 1 0; min-height: 0; max-height: 100%; overflow: hidden; }

    /* Mobile Overlay */
    .mobile-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 150;
    }

    /* Mobile Bottom Nav */
    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 64px;
      background: white;
      border-top: 1px solid var(--color-border);
      padding-bottom: env(safe-area-inset-bottom);
      z-index: 100;
      box-shadow: var(--shadow-header);
    }

    .bottom-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      color: var(--color-text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      min-height: 48px;
      transition: color 0.15s;
      text-decoration: none;
    }

    .bottom-nav-item:active { background: var(--color-bg-tertiary); }
    .bottom-nav-item.active { color: var(--color-primary); }

    .bottom-nav-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Mobile Styles */
    @media (max-width: 768px) {
      .mobile-header { display: flex; }
      .mobile-overlay { display: block; }

      .main-content {
        margin-left: 0;
        padding: 0;
        padding-top: 56px;
        padding-bottom: calc(64px + env(safe-area-inset-bottom));
        height: 100svh;
        height: 100vh;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .mobile-bottom-nav { display: flex; }
    }
  `]
})
export class LayoutComponent implements OnInit {
  mobileMenuOpen = signal(false);
  showAccountModal = signal(false);

  /** True for routes that own their internal scrolling (chat): .routed-area
   *  then fits the shell exactly instead of growing past it, so the chat
   *  message list clamps to the viewport and the composer stays visible. */
  routedAreaFits = signal(false);

  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApi);

  router = inject(Router);

  constructor() {
    // Publish the impersonation banner height as a global CSS var so the fixed
    // sidebar + main scroll region (across components) shift down to clear it.
    effect(() => {
      const on = !!this.auth.impersonatingFirm();
      document.documentElement.style.setProperty('--imp-h', on ? '40px' : '0px');
    });
  }

  /** Exit "view as company": restore the admin session server-side, swap the
   *  user back, and return to the organizations admin view. */
  async exitImpersonation() {
    try {
      const me = await this.authApi.exitImpersonation();
      this.auth.setUser({
        id: me.id,
        email: me.email,
        name: me.name,
        role: me.role,
        firmId: me.firmId ?? undefined,
      });
    } finally {
      this.auth.setImpersonatingFirm(null);
      // Full-page reload back into the admin view — symmetric with the
      // reload-based entry, so the app re-bootstraps cleanly as the admin.
      window.location.hash = '#/admin/organizations';
      window.location.reload();
    }
  }

  /** Keep the self-scrolling-route flag in sync with the current URL. */
  private syncRoutedAreaFit(url: string) {
    const path = (url || '').split('?')[0].split('#')[0];
    // Both chat surfaces own their internal scrolling: the user chat and the
    // admin research chat. Every other admin tab keeps the normal
    // grow-never-shrink behaviour so long tables can scroll the shell.
    this.routedAreaFits.set(path.startsWith('/admin/research-chat'));
  }

  ngOnInit() {
    this.syncRoutedAreaFit(this.router.url);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.syncRoutedAreaFit(e.urlAfterRedirects);
    });

    // The account/settings popup is a routable overlay: its open state is the
    // ?dialog=account query param, so it carries a unique hash route for the
    // feedback widget's per-route key and survives refresh / back-button.
    this.route.queryParamMap.subscribe((qp) => {
      this.showAccountModal.set(qp.get('dialog') === 'account');
    });
  }

  headerTitle = computed(() => {
    return this.auth.hasAdminRole()
      ? ('Administrator console')
      : ('Enterprise Platform');
  });

  // SHARED_NAV_ITEMS (Saved Searches) is appended for BOTH roles: saved
  // searches are per-user rows, not a firm-only or console-only feature, so the
  // mobile bottom nav must expose the same role-agnostic entry the sidebar does
  // — otherwise the link disappears entirely on narrow viewports.
  bottomNavItems = computed<NavItem[]>(() => {
    if (this.auth.hasAdminRole()) return [...ADMIN_NAV_ITEMS, ...SHARED_NAV_ITEMS];
    // Firm users (mobile): Chat, Documents, Learning, Analysis (skip Overview)
    return [...FIRM_NAV_ITEMS.slice(0, 4), ...SHARED_NAV_ITEMS];
  });

  toggleMobileMenu() { this.mobileMenuOpen.update(v => !v); }
  closeMobileMenu() { this.mobileMenuOpen.set(false); }

  openAccountModal() {
    void this.router.navigate([], { queryParams: { dialog: 'account' }, queryParamsHandling: 'merge' });
  }
  closeAccountModal() {
    void this.router.navigate([], { queryParams: { dialog: null }, queryParamsHandling: 'merge' });
  }

  setAdminTab(tabLabel: string) {
    // Role-agnostic bottom-nav entries (e.g. Saved Searches) own a real route
    // and no admin console tab — they must NOT be coerced into 'overview',
    // which would fight the routerLink navigation they just triggered.
    const tab = ADMIN_TAB_MAP[tabLabel];
    if (!tab) return;
    this.auth.setAdminTab(tab);
  }
}
