import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'html',
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4321',
    headless: true,
    launchOptions: { slowMo: 300 },
    screenshot: 'only-on-failure',
    video: 'on',
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: 'npm run build && node scripts/serve-vercel-output.mjs',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
