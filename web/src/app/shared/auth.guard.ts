import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService, User } from './auth.service';
import { AuthApi } from './api/auth-api.service';
import { PREVIEW_MODE } from './preview/preview-mode';

const ROLES: readonly User['role'][] = ['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

/**
 * Confirm the session with the server (GET auth/me). Returns the signed-in
 * user, or null when the server does not recognise a session. A local user
 * left in storage is never trusted on its own: a 401 clears it.
 */
async function confirmSession(): Promise<User | null> {
  const auth = inject(AuthService);
  const api = inject(AuthApi);
  const local = auth.user();
  if (PREVIEW_MODE) return local;

  const me = await api.me();
  if (me === null) {
    if (local) auth.signOut();
    return null;
  }
  const serverRole = ROLES.includes(me.role as User['role']) ? (me.role as User['role']) : null;
  if (typeof me.id === 'string' && me.id && typeof me.email === 'string' && serverRole) {
    const confirmed: User = {
      ...(local ?? {}),
      id: me.id,
      email: me.email,
      name: me.name || local?.name || me.email.split('@')[0],
      role: serverRole,
    };
    if (!local || local.id !== confirmed.id || local.role !== confirmed.role) {
      auth.setUser(confirmed);
    }
    return confirmed;
  }
  // The server answered without an identity body; only an existing local
  // session (established by a server login) may continue.
  return local;
}

function loginRedirect(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}

/** Signed-in users only; everyone else is sent to /login?returnUrl=… */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const user = await confirmSession();
  return user ? true : loginRedirect(router, state.url);
};

/** ADMIN (or SUPER_ADMIN) only; other signed-in roles go to the dashboard. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const user = await confirmSession();
  if (!user) return loginRedirect(router, state.url);
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    ? true
    : router.createUrlTree(['/dashboard']);
};
