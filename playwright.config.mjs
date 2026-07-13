import { defineConfig } from '@playwright/test'

// Electron E2E. These drive the BUILT app (out/main/index.js), so run
// `npm run build` first — the `e2e` npm script does this for you. Electron
// allows one app instance per launch and the specs read real OS window
// geometry, so keep this fully serial (workers: 1, no retries hiding
// flakiness). Local-only for now: CI would need a virtual display (xvfb/headed).
// See e2e/README.md and Comhaigne/docs/architecture/e2e-playwright-electron.md.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 }
})
