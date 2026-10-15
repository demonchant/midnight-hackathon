// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4178';
const projectRoot = process.cwd();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '.cpg-artifacts/playwright-report', open: 'never' }]],
  outputDir: '.cpg-artifacts/playwright-results',
  use: { baseURL, headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'node server.mjs',
    url: `${baseURL}/api/status`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      CPG_PROJECT_ROOT: projectRoot,
      CPG_HOST: '127.0.0.1',
      CPG_PORT: '4178'
    }
  }
});
