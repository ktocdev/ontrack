import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    // WebKit is the stand-in for an iPhone until a real-device pass.
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    // The e2e build signs in from a role picker instead of Supabase.
    command: 'npm run build && npm run preview',
    env: { VITE_E2E_MOCK: '1' },
    port: PORT,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
})
