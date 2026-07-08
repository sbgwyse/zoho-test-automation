import { chromium } from '@playwright/test';

export async function verifyLogin(
  url: string,
  username: string,
  password: string
): Promise<boolean> {

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(url);

    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);

    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForTimeout(3000);

    const invalid = await page
      .getByText('Invalid Username or Password')
      .isVisible()
      .catch(() => false);

    await browser.close();

    return !invalid;

  } catch (err) {
    await browser.close();
    return false;
  }
}