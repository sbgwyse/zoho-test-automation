// task-scenario-ai.spec.ts
//
// Same duty-roster "No Data Found" bug check as task-scenario.spec.ts,
// but instead of hardcoded locators, each step is a plain-English
// instruction resolved to a real element at runtime via ai-locator.ts.
//
// Requires ANTHROPIC_API_KEY in .env (in addition to APP_TEST_* vars).
//
// Usage:
//   npx playwright test task-scenario-ai.spec.ts

import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { resolveAndAct } from './ai-locator';

const BASE_URL = process.env.APP_TEST_URL || 'http://192.168.0.23:4200/login';
const USERNAME = process.env.APP_TEST_USERNAME || '';
const PASSWORD = process.env.APP_TEST_PASSWORD || '';

if (!USERNAME || !PASSWORD) {
  throw new Error('APP_TEST_USERNAME / APP_TEST_PASSWORD not set in .env');
}
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY not set in .env — required for AI-resolved locators.');
}

test.setTimeout(300000);

test('Duty Roster Upload - No Data Found bug check (AI-resolved)', async ({ page }, testInfo) => {

  await testInfo.attach('report-meta', {
    body: JSON.stringify({
      formTitle: 'Duty Roster - No Data Found Bug Verification (AI-resolved locators)',
      moduleName: 'Duty Roster',
      websiteUrl: BASE_URL,
    }),
    contentType: 'application/json',
  });

  await test.step('Login', async () => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await resolveAndAct(page, 'the username input field', USERNAME);
    await resolveAndAct(page, 'the password input field', PASSWORD);
    await resolveAndAct(page, 'the Sign In button');
    await page.waitForLoadState('networkidle');

    const shot1 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Login', { body: shot1, contentType: 'image/png' });
  });

  await test.step('Navigate to Duty Roster', async () => {
    await resolveAndAct(page, 'the REGISTRATION menu item');
    await resolveAndAct(page, 'the dropdown to select a module', 'Duty Roster');
    await page.waitForLoadState('networkidle');

    const shot2 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Navigate to Duty Roster', { body: shot2, contentType: 'image/png' });
  });

  await test.step('Set filters - Year, Month, Application Type', async () => {
    await resolveAndAct(page, 'the Year dropdown', '2026');
    await resolveAndAct(page, 'the Month dropdown', 'July');
    await resolveAndAct(page, 'the Application Type dropdown', 'Shift');
  });

  await test.step('Select employee', async () => {
    await resolveAndAct(page, 'the Select a Department dropdown');
    // Checkbox/virtual-scroll/cell selection is positional, not name-based —
    // AI resolution isn't a good fit for these; kept as direct locators.
    await page.getByRole('checkbox').nth(1).click();
    await page.locator('.cdk-virtual-scroll-viewport').click();
    await page.getByRole('cell', { name: '100000001' }).click();

    const shot3 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Select employee', { body: shot3, contentType: 'image/png' });
  });

  await test.step('Verify data appears (no "No Data Found")', async () => {
    const shot4 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Verify data appears', { body: shot4, contentType: 'image/png' });

    const noDataMessage = page.getByText('No Data Found');
    const isBugPresent = await noDataMessage.isVisible().catch(() => false);

    if (isBugPresent) {
      throw new Error('BUG REPRODUCED: "No Data Found" message shown after duty roster upload.');
    }

    console.log('✓ No "No Data Found" message shown — bug does not reproduce.');
  });
});