import { defineConfig, devices } from '@playwright/test'

/**
 * Flows that read and write real data, against the seeded local Supabase
 * stack (`supabase start`). CI starts the stack and passes its URL and
 * publishable key as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. It cannot run
 * on a machine without Docker; the mock-build suite (playwright.config.ts)
 * covers everything that needs no backend.
 *
 * One worker: the tests share one database and some change a seeded person.
 */
const PORT = 4174
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e/stack',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-stack' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The service worker precaches the whole app on every new page; with many
    // workers that crowds out the lazy route chunks. No test needs it.
    serviceWorkers: 'block',
    // Every test starts on a phone that was already offered the install (OT-72), so its sheet
    // doesn't cover the screen; e2e/install.spec.ts starts without it.
    storageState: {
      cookies: [],
      origins: [
        { origin: `http://localhost:${PORT}`, localStorage: [{ name: 'ontrack.install-asked', value: 'e2e' }] },
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !CI,
    // The public half of the throwaway pair in supabase/config.toml.
    env: {
      VITE_VAPID_PUBLIC_KEY: 'BC76FoDZqBIxtniIWjxpl9O6T0wB8LJP_hqhuaQzUSRVpwnAERub30EZo0UPeXYEY_fAZQ3cObCB1BjW720zIL8',
    },
    timeout: 180_000,
  },
})
