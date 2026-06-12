import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const serverURL = new URL(baseURL);
const serverHost = serverURL.hostname || '127.0.0.1';
const serverPort = serverURL.port || '3000';
const e2eDatabaseURL = normalizeDatabaseURL(
  process.env.PLAYWRIGHT_DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'e2e-worldcup.db')}`,
);
const databaseEnv = `DATABASE_URL=${JSON.stringify(e2eDatabaseURL)}`;

function normalizeDatabaseURL(databaseURL: string): string {
  if (!databaseURL.startsWith('file:')) {
    return databaseURL;
  }

  const filePath = databaseURL.slice('file:'.length);

  if (path.isAbsolute(filePath)) {
    return databaseURL;
  }

  return `file:${path.resolve(process.cwd(), filePath)}`;
}

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `${databaseEnv} npm run db:deploy && ${databaseEnv} npm run db:seed && ${databaseEnv} npm run build && ./scripts/sync-standalone-assets.sh && ${databaseEnv} HOSTNAME=${JSON.stringify(serverHost)} PORT=${JSON.stringify(serverPort)} node .next/standalone/server.js`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
