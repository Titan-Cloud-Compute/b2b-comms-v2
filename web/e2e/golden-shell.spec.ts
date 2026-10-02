/**
 * Lead-written fail-to-pass oracle for docs/plans/template-skeleton.md (U1 web/skeleton).
 *
 * Verify expr copies this file into scaffold-templates/template-enterprise/web/e2e/
 * and runs it under playwright.hermetic.config.ts (static SPA, hash routing,
 * every /api/** call mocked here — nothing reaches the network).
 *
 * FAILS today because: '' redirects to /login (no landing page), /login carries a
 * "Register your company with a registration code" link, no [data-placeholder]
 * marker exists anywhere in web/src, and there is no forgot/reset flow.
 *
 * serviceWorkers:'block' — the build ships ngsw-worker.js; once it registers, the
 * app's fetches go through the worker and page.route never sees them (the mocked
 * login then returns the SPA's index.html and the app shows "Something went wrong").
 */
import { test, expect, type Page } from '@playwright/test';

const KEPT_ROUTES = [
  'dashboard', 'settings',
  'admin/overview', 'admin/users', 'admin/app-settings',
];
// Regex built from split fragments so the template source itself does not
// contain the literal strings (the content-sweep grep would flag them).
const LOCALE_GUARD = new RegExp(
  ['bul' + 'gar', 'nap' + '\\.bg', '\\b' + 'EI' + 'K\\b', 'VI' + 'ES', '\\bBG' + 'N\\b'].join('|'),
  'i',
);

async function mockApi(page: Page): Promise<void> {
  const store: { user: { id: string; email: string; role: string } | null } = { user: null };
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const apiPath = new URL(req.url()).pathname
      .replace(/^.*\/api\//, '').replace(/^api\//, '').replace(/^\//, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'POST' && apiPath === 'auth/login') {
      store.user = { id: '1', email: 'user@example.com', role: 'USER' };
      return json(store.user);
    }
    if (method === 'GET' && apiPath === 'users/me') {
      return store.user ? json(store.user) : json({ message: 'Unauthorized' }, 401);
    }
    if (method === 'POST' && apiPath === 'auth/password-reset/request') return json({ ok: true });
    if (method === 'POST' && apiPath === 'auth/password-reset/confirm') return json({ ok: true });
    if (method === 'GET') return json([]);          // every list endpoint is empty on a fresh DB
    return json({ ok: true });
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('password1234');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 10_000 });
}

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => { await mockApi(page); });

test('landing page renders at / without redirecting to login and links to Sign in', async ({ page }) => {
  await page.goto('/#/');
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toMatch(/#\/login/);
  await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(LOCALE_GUARD);
});

test('login page has no register link and no registration-code copy', async ({ page }) => {
  await page.goto('/#/login');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.getByRole('link', { name: /regist|sign up/i })).toHaveCount(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/registration code/i);
  expect(body).not.toMatch(LOCALE_GUARD);
  await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
});

test('login lands in the sidebar shell with an empty placeholder main area', async ({ page }) => {
  await login(page);
  await expect(page.locator('aside.sidebar')).toBeVisible();
  await expect(page.locator('main.main-content [data-placeholder]').first()).toBeVisible();
  const nav = await page.locator('aside.sidebar nav.sidebar-nav').innerText();
  for (const label of ['Dashboard']) expect(nav).toContain(label);
});

test('forgot-password → request → reset with token → back to login', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByRole('link', { name: /forgot/i }).click();
  await expect(page).toHaveURL(/#\/forgot-password/);
  await page.locator('#email').fill('admin@example.com');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('body')).toContainText(/check your (email|inbox)|sent/i);

  await page.goto('/#/reset-password?token=t-123');
  await page.locator('#password').fill('newpassword1234');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
});

test('every kept route renders a data-free placeholder with no locale-specific strings', async ({ page }) => {
  await login(page);
  for (const r of KEPT_ROUTES) {
    await page.goto(`/#/${r}`);
    await expect(page.locator('main.main-content [data-placeholder]').first(), r).toBeVisible();
    expect(await page.locator('body').innerText(), r).not.toMatch(LOCALE_GUARD);
  }
});
