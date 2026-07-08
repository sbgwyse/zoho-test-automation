import { chromium, Browser, Page } from '@playwright/test';
import * as readline from 'readline';
import { login } from './login';

const { browser, page } = await login(url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function login(url: string): Promise<{ browser: Browser; page: Page }> {
  while (true) {
    const username = await ask('Username: ');
    const password = await ask('Password: ');

    const browser = await chromium.launch({
      headless: false,
    });

    const page = await browser.newPage();

    await page.goto(url);

    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);

    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForTimeout(3000);

    const invalid = await page
      .getByText('Invalid Username or Password')
      .isVisible()
      .catch(() => false);

    if (invalid) {
      console.log('\n❌ Invalid Username or Password\n');
      await browser.close();
      continue;
    }

    console.log('\n✅ Login Successful\n');

    return { browser, page };
  }
}