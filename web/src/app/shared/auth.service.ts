import { Injectable, signal, computed, effect } from '@angular/core';
import { PREVIEW_MODE, nsKey } from './preview/preview-mode';

export type Theme = 'light' | 'dark';

export interface User {
  id: string;
  email: string;
  name: string;
  firmName?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  firmId?: string;
}

const ROLES: readonly User['role'][] = ['USER', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Parse a persisted user, returning null for anything that is not a valid
 * session. Shape-checked rather than just JSON-parsed: a truncated or
 * older-format value would otherwise restore a half-built user and break
 * screens far away from here.
 */
function parseStoredUser(raw: string): User | null {
  try {
    const value = JSON.parse(raw) as Partial<User> | null;
    if (!value || typeof value !== 'object') return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    if (typeof value.email !== 'string' || !value.email) return null;
    if (!ROLES.includes(value.role as User['role'])) return null;
    return {
      ...value,
      name: typeof value.name === 'string' ? value.name : value.email,
    } as User;
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _user = signal<User | null>(null);
  private _theme = signal<Theme>('light'); // Default to light theme
  private _adminTab = signal<string>('overview'); // Admin tab state shared between layout and admin
  // Firm name when an admin is "viewing as company" (read-only impersonation),
  // else null. Persisted so the banner survives a reload.
  private _impersonatingFirm = signal<string | null>(null);

  // "Email me when my diagnostic is ready" opt-in. Held here (rather than on
  // the diagnostic component) so the checkbox on the diagnostic page and the
  // one in Settings → Notifications share a single source of truth, and
  // persisted locally so the choice survives a reload. The value is sent with
  // every `diagnostic/generate` request as `notifyByEmail`.
  private _diagnosticReadyEmail = signal<boolean>(false);
  /** True when a diagnostic-completion email is requested for this account. */
  diagnosticReadyEmail = computed(() => this._diagnosticReadyEmail());

  // Public readonly signals
  user = computed(() => this._user());
  theme = computed(() => this._theme());
  adminTab = computed(() => this._adminTab());
  impersonatingFirm = computed(() => this._impersonatingFirm());

  constructor() {
    // Language is always English.
    document.documentElement.lang = 'en';

    // Load saved theme preference (default is light)
    const savedTheme = this.read('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this._theme.set(savedTheme);
    } else {
      // Default to light theme
      this._theme.set('light');
    }
    // Apply theme to document
    this.applyTheme(this._theme());

    // Load saved user session. Anything in storage is untrusted — a value from
    // an older build (or another tab) must not throw here, because this runs
    // during bootstrap and a throw leaves the reviewer on a blank page.
    const savedUser = this.read('user');
    if (savedUser) {
      const parsed = parseStoredUser(savedUser);
      if (parsed) this._user.set(parsed);
      else this.clearSessionKeys();
    }

    // Restore an in-progress "view as company" impersonation so the banner
    // shows after a reload (the read-only cookie itself is httpOnly).
    const savedImp = this.read('impersonatingFirm');
    if (savedImp) this._impersonatingFirm.set(savedImp);

    // Restore the "email me when my diagnostic is ready" opt-in.
    const savedNotify = this.read('diagnosticReadyEmail');
    if (savedNotify !== null) this._diagnosticReadyEmail.set(savedNotify === '1');
    // …then reconcile with the account-level value the server holds, so the
    // choice follows the user across devices rather than living in one browser.
    void this.loadNotificationPreferences();
  }

  /**
   * Absolute URL of the notification-preferences endpoint. Resolved against
   * `document.baseURI` so it survives the path prefix the staging ingress adds
   * (plain `fetch` would otherwise resolve relative to the current hash route).
   */
  private prefsUrl(): string {
    try {
      return new URL('api/users/me/notification-preferences', document.baseURI).toString();
    } catch {
      return 'api/users/me/notification-preferences';
    }
  }

  /**
   * Read the account-level notification preferences. Uses `fetch` rather than
   * ApiClient because AuthService is a dependency of the HTTP layer — injecting
   * it back here would create a DI cycle. Silent on every failure: a signed-out
   * visitor (401) or an offline load must never break bootstrap; the locally
   * persisted value simply stands.
   */
  private async loadNotificationPreferences(): Promise<void> {
    if (PREVIEW_MODE) return;
    try {
      const res = await fetch(this.prefsUrl(), { credentials: 'include' });
      if (!res.ok) return;
      const body = (await res.json()) as { diagnosticReadyEmail?: boolean } | null;
      if (typeof body?.diagnosticReadyEmail === 'boolean') {
        this._diagnosticReadyEmail.set(body.diagnosticReadyEmail);
        this.write('diagnosticReadyEmail', body.diagnosticReadyEmail ? '1' : '0');
      }
    } catch {
      /* preference stays at its locally persisted value */
    }
  }

  /**
   * Record the "email me when my diagnostic is ready" opt-in. Persisted locally
   * so both the diagnostic page and Settings → Notifications show the same
   * state after a reload; the value travels to the server on the next
   * `diagnostic/generate` call.
   */
  setDiagnosticReadyEmail(value: boolean): void {
    this._diagnosticReadyEmail.set(value);
    this.write('diagnosticReadyEmail', value ? '1' : '0');
    // Persist on the ACCOUNT too (the generation worker reads it there when the
    // report finishes and the tab is long gone). Optimistic: the UI already
    // shows the new state; a failed write leaves the local value in place.
    if (PREVIEW_MODE) return;
    void fetch(this.prefsUrl(), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnosticReadyEmail: value }),
    }).catch(() => undefined);
  }

  /**
   * Storage accessors. Keys go through `nsKey` — identity in production, and
   * prefixed with the mockup id in the preview, where every mockup shares one
   * origin. Wrapped because storage can be blocked outright (Safari private
   * mode, embedded webviews) and no read of it may break bootstrap.
   */
  private read(key: string): string | null {
    try {
      return localStorage.getItem(nsKey(key));
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(nsKey(key), value);
    } catch {
      /* storage unavailable — the preference just does not persist */
    }
  }

  private drop(key: string): void {
    try {
      localStorage.removeItem(nsKey(key));
    } catch {
      /* ignore */
    }
  }

  private clearSessionKeys(): void {
    for (const key of ['user', 'token', 'access_token', 'isAuthenticated']) {
      this.drop(key);
    }
  }

  /** Enter/exit the "view as company" banner state. Pass the firm name to enter,
   *  null to exit. The firm-scoped session cookie is set server-side. */
  setImpersonatingFirm(firmName: string | null) {
    this._impersonatingFirm.set(firmName);
    if (firmName) this.write('impersonatingFirm', firmName);
    else this.drop('impersonatingFirm');
  }


  setTheme(theme: Theme) {
    this._theme.set(theme);
    this.write('theme', theme);
    this.applyTheme(theme);
  }

  toggleTheme() {
    const newTheme = this._theme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  private applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Patch the in-memory user (e.g. after a profile save) so the UI reflects
   *  the change without a full re-login. No-op if not signed in. */
  patchUser(patch: Partial<User>) {
    const current = this._user();
    if (current) this.setUser({ ...current, ...patch });
  }

  setUser(user: User | null) {
    this._user.set(user);
    if (user) {
      this.write('user', JSON.stringify(user));
      this.write('token', 'demo-token-' + user.id);
      this.write('access_token', 'demo-access-token-' + user.id);
      this.write('isAuthenticated', 'true');
      // A session just started — pick up this account's stored notification
      // preferences (the boot-time read ran while signed out).
      void this.loadNotificationPreferences();
    } else {
      this.clearSessionKeys();
    }
  }

  hasAdminRole(): boolean {
    const role = this._user()?.role;
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  isSuperAdmin(): boolean {
    return this._user()?.role === 'SUPER_ADMIN' || this._user()?.role === 'ADMIN';
  }

  isAuthenticated(): boolean {
    return this._user() !== null;
  }

  signOut() {
    this.setUser(null);
    this.setImpersonatingFirm(null);
  }

  setAdminTab(tab: string) {
    this._adminTab.set(tab);
  }

  // Demo login helper for admin
  demoAdminLogin() {
    this.setUser({
      id: 'demo-admin',
      email: 'admin@example.com',
      name: 'Demo Administrator',
      role: 'ADMIN',
      firmId: undefined,
      firmName: undefined
    });
  }

}
