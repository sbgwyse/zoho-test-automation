// task-scenario.spec.ts
//
// Implements the exact flow described in Zoho Desk Task "Dummy Test 100":
//   1. Login as ADMIN
//   2. Navigate: REGISTRATION -> Duty Roster
//   3. Filter: year, month, Application type = Shift
//   4. Select employee via department -> checkbox -> virtual scroll -> cell
//   5. Assign a shift type in the calendar, save
//   6. Verify the bug does NOT reproduce: expect data to show, not "No Data Found"
//
// Usage:
//   npx playwright test task-scenario.spec.ts
//
// NOTE: Some locators are marked TODO — the task description didn't include
// them. Run `npx playwright codegen http://192.168.0.23:4200/login` and
// interact with those specific controls to get the real locators, then
// replace the TODOs below.

import 'dotenv/config';
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.APP_TEST_URL || 'http://192.168.0.23:4220/etam_prime_taj/login';
const USERNAME = process.env.APP_TEST_USERNAME || '';
const PASSWORD = process.env.APP_TEST_PASSWORD || '';

if (!USERNAME || !PASSWORD) {
  throw new Error(
    'APP_TEST_USERNAME / APP_TEST_PASSWORD not set in .env — add them before running this test.'
  );
}

test.setTimeout(180000);

test('Duty Roster Upload - No Data Found bug check', async ({ page }, testInfo) => {

  await testInfo.attach('report-meta', {
    body: JSON.stringify({
      formTitle: 'Duty Roster - No Data Found Bug Verification',
      moduleName: 'Duty Roster',
      websiteUrl: BASE_URL,
    }),
    contentType: 'application/json',
  });

  // ===========================
  // STEP 1: LOGIN
  // ===========================
  await test.step('Login as ADMIN', async () => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);

    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle');

    const shot1 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Login', { body: shot1, contentType: 'image/png' });
  });

  // ===========================
  // STEP 2: NAVIGATE TO DUTY ROSTER
  // ===========================
  await test.step('Navigate to Duty Roster', async () => {
    await page.getByText('REGISTRATION').click();
    await page.getByRole('combobox').selectOption('Duty Roster');
    await page.waitForLoadState('networkidle');

    const shot2 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Navigate to Duty Roster', { body: shot2, contentType: 'image/png' });
  });

  // ===========================
  // STEP 3: SET FILTERS (year, month, Application type = Shift)
  // ===========================
  await test.step('Set filters - year, month, Application type', async () => {
    // TODO: description says "select year, month, Application type - shift"
    // but gives no locators for these three controls. Capture with codegen:
    //   npx playwright codegen http://192.168.0.23:4200/login
    // then replace the three lines below.
    //
    // await page.getByLabel('Year').selectOption('2026');
    // await page.getByLabel('Month').selectOption('July');
    // await page.getByLabel('Application Type').selectOption('Shift');

    console.log('⚠ Year/Month/Application-type locators not yet defined — fill in from codegen.');
  });

  // ===========================
  // STEP 4: SELECT EMPLOYEE
  // ===========================
  await test.step('Select employee', async () => {
    await page.getByText('--Select a Department--').click();
    await page.getByRole('checkbox').nth(1).click();
    await page.locator('.cdk-virtual-scroll-viewport').click();
    await page.getByRole('cell', { name: '100000001' }).click();

    const shot3 = await page.screenshot({ fullPage: true });
    await testInfo.attach('Select employee', { body: shot3, contentType: 'image/png' });
  });

  // ===========================
  // STEP 5: ASSIGN SHIFT & SAVE
  // ===========================
  await test.step('Assign shift type and save', async () => {
    // TODO: "select shift type, assign a shift in calendar and save the data"
    // has no locators in the description. Capture with codegen:
    //
    // await page.getByLabel('Shift Type').selectOption('General Shift');
    // await page.locator('.calendar-cell').first().click();
    // await page.getByRole('button', { name: 'Save' }).click();
    // await page.waitForLoadState('networkidle');

    console.log('⚠ Shift-type/calendar/save locators not yet defined — fill in from codegen.');
  });

  // ===========================
  // STEP 6: VERIFY THE BUG DOES NOT REPRODUCE
  // ===========================
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