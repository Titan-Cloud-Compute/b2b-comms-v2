/**
 * Auth guard oracle: shell routes are deny-by-default, the session is confirmed
 * by the server (GET auth/me), and admin pages are ADMIN-only.
 * Every /api/** call is mocked — nothing reaches the network.
 */
import { test, expect, type Page } from '@playwright/test';

type Role = 'USER' | 'MANAGER' | 'ADMIN';

async function mockApi(page: Page, role: Role | null): Promise<{ signIn: (r: Role) => void }> {
  const store: { user: { id: string; email: string; role: Role } | null } = {
    user: role ? { id: 'u-' + role, email: role.toLowerCase() + '@demo.local', role } : null,
  };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname
      .replace(/^.*\/api\//, '').replace(/^api\//, '').replace(/^\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'POST' && apiPath === 'auth/login') {
      const body = JSON.parse(req.postData() || '{}') as { email?: string };
      const r: Role = /admin/.test(body.email ?? '') ? 'ADMIN' : /manager/.test(body.email ?? '') ? 'MANAGER' : 'USER';
      store.user = { id: 'u-' + r, email: body.email ?? 'user@demo.local', role: r };
      return json(store.user);
    }
    if (method === 'GET' && (apiPath === 'auth/me' || apiPath === 'users/me')) {
      return store.user ? json(store.user) : json({ message: 'Unauthorized' }, 401);
    }
    if (method === 'GET') return json([]);
    return json({ ok: true });
  });
  return { signIn: (r: Role) => { store.user = { id: 'u-' + r, email: r.toLowerCase() + '@demo.local', role: r }; } };
}

async function login(page: Page, email: string): Promise<void> {
  await page.locator('form.login-form #email').fill(email);
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
}

for (const target of ['dashboard', 'admin/users']) {
  test(`signed-out visit to /${target} lands on sign-in with returnUrl`, async ({ page }) => {
    await mockApi(page, null);
    await page.goto(`/#/${target}`);
    await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
    expect(decodeURIComponent(page.url())).toContain(`returnUrl=/${target}`);
    await expect(page.locator('form.login-form #email')).toBeVisible();
    await expect(page.locator('aside.sidebar')).toHaveCount(0);
  });
}

test('a stale local session the server rejects is sent to sign-in', async ({ page }) => {
  await mockApi(page, null);
  await page.goto('/#/login');
  await page.evaluate(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'x', email: 'x@demo.local', name: 'x', role: 'ADMIN' }));
  });
  await page.goto('/#/dashboard');
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
});

test('USER signs in and reaches the dashboard but not admin pages', async ({ page }) => {
  await mockApi(page, null);
  await page.goto('/#/dashboard');
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
  await login(page, 'user@demo.local');
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
  await page.goto('/#/admin/users');
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
});

test('MANAGER signs in and is kept out of admin pages', async ({ page }) => {
  await mockApi(page, null);
  await page.goto('/#/login');
  await login(page, 'manager@demo.local');
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
  await page.goto('/#/admin/users');
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
});

test('ADMIN signs in and reaches admin users', async ({ page }) => {
  await mockApi(page, null);
  await page.goto('/#/login');
  await login(page, 'admin@demo.local');
  await expect(page).toHaveURL(/#\/admin/, { timeout: 10_000 });
  await page.goto('/#/admin/users');
  await expect(page).toHaveURL(/#\/admin\/users/, { timeout: 10_000 });
});
