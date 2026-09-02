import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});