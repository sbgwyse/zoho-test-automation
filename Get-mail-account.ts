// get-mail-account.ts
//
// One-off helper: prints your Zoho Mail account info (including
// accountId) so you can fill in ZOHO_MAIL_ACCOUNT_ID in your .env.
//
// Run with: npx ts-node get-mail-account.ts
// (or: npx tsx get-mail-account.ts)

import 'dotenv/config';
import fetch from 'node-fetch';
import { getAccessToken } from './fetch-ticket';

async function main() {

  const token = await getAccessToken();

  const { ZOHO_MAIL_API_DOMAIN } = process.env as any;

  const domain = ZOHO_MAIL_API_DOMAIN || 'https://mail.zoho.in';

  const res = await fetch(`${domain}/api/accounts`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });

  const text = await res.text();

  console.log('Status:', res.status);
  console.log('Response:', text);

}

main().catch(err => {
  console.error(err);
  process.exit(1);
});