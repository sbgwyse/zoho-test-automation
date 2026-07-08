import { chromium } from '@playwright/test';
import * as readline from 'readline';

interface LoginCredentials {
  username: string;
  password: string;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function validateLogin(loginUrl: string): Promise<LoginCredentials> {

  while (true) {

    console.log('\n==============================');
    console.log('LOGIN VALIDATION');
    console.log('==============================');

    const username = await ask('Username: ');
    const password = await ask('Password: ');

    const browser = await chromium.launch({
      headless: false,
    });

    const page = await browser.newPage();

    try {

      await page.goto(loginUrl);

      await page.getByRole('textbox', { name: 'Username' }).fill(username);

      await page.getByRole('textbox', { name: 'Password' }).fill(password);

      await page.getByRole('button', { name: 'Sign In' }).click();

      await page.waitForTimeout(3000);

      //
      // SUCCESS
      //
      if (
        page.url().includes('/etam_prime_taj/client')
      ) {

        console.log('\n✓ Login Successful\n');

        await browser.close();

        return {
          username,
          password,
        };
      }

      //
      // INVALID LOGIN MESSAGE
      //
      const invalidMessage = page.getByText('Invalid Username or Password');

      if (await invalidMessage.isVisible().catch(() => false)) {

        console.log('\n❌ Invalid Username or Password.\nPlease try again.\n');

        await browser.close();

        continue;
      }

      console.log('\n❌ Login could not be validated.\n');

      await browser.close();

    } catch (err) {

      console.log('\nError while validating login.');

      console.log(err);

      await browser.close();
    }

  }

}