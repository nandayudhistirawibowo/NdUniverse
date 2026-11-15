import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'html',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    launchOptions: { slowMo: 300 },
    screenshot: 'only-on-failure',
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
