/**
 * GATE 2 config — the six-client end-to-end game test.
 *
 * The webServer is scripts/harness.mjs: it serves ./dist (SPA fallback) on
 * port 8788 and proxies /api/* to the LIVE deployed Supabase edge function.
 * Run `npm run build` first — the harness serves whatever is in dist/.
 *
 * retries is pinned to 0 on purpose: every full run creates one real room on
 * the live backend (create-room is limited to 20/hour/IP) — never retry
 * automatically.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 20 * 60 * 1000, // the full six-player game takes several minutes
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8788',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/harness.mjs',
    url: 'http://localhost:8788',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
