import { defineConfig, devices } from '@playwright/test';

// Hermetic port: honour PW_PORT when set; otherwise derive a per-process port so concurrent
// runs in one host never collide on a fixed 4200. Playwright re-evaluates this config in every
// worker process, so pin the chosen port into the environment — workers inherit it and
// navigate to the same server the runner started.
const port = Number(process.env.PW_PORT) || 4200 + (process.pid % 20000);
if (!process.env.PW_PORT) process.env.PW_PORT = String(port);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node e2e/serve-spa.mjs dist/frontend/browser ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
  },
});
