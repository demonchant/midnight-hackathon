import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4179';

export default defineConfig({
  testDir: './e2e-public',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '.cpg-artifacts/public-playwright-results',
  use: { baseURL, headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'node public-server.mjs',
    url: `${baseURL}/api/status`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { ...process.env, CPG_PUBLIC_HOST: '127.0.0.1', CPG_PUBLIC_PORT: '4179', CPG_TRUST_PROXY: 'render', CPG_COMPILER_MODE: 'direct' }
  }
});
