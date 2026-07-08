import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 180000,
  retries: 0,

  // This is what was missing — without a reporter configured, Playwright
  // defaults to just printing to the terminal and never writes an HTML
  // report, which is why `npx playwright show-report` found nothing.
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['./custom-report.ts'],
  ],

  use: {
    // Always capture a screenshot on failure (set to 'on' to capture every step)
    screenshot: 'only-on-failure',

    // Records a video of the whole run — lets you literally watch it play back
    video: 'retain-on-failure',

    // Records a full step-by-step trace (DOM snapshots, network, console,
    // actions) that you can scrub through like a timeline in the Trace Viewer
    trace: 'retain-on-failure',

    // Run with a visible browser window so you can watch it live as it runs.
    // Set to true once you no longer need to watch it manually.
    headless: false,
  },
});