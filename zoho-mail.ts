// zoho-mail.ts
//
// Sends the automation report as a standalone email via the Zoho Mail
// API, reusing the same OAuth access token used for Zoho Desk.
//
// Requires these additional vars in your .env:
//   ZOHO_MAIL_API_DOMAIN   e.g. https://mail.zoho.com  (or your region's domain)
//   ZOHO_MAIL_ACCOUNT_ID   the mailbox account id the mail is sent from
//   ZOHO_MAIL_FROM_ADDRESS the "from" address for that account
//
// Also make sure the refresh token's OAuth scope includes Zoho Mail
// send access (e.g. ZohoMail.messages.CREATE) in addition to Desk scopes.

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';


export async function sendEmailWithReport(
  accessToken: string,
  toAddress: string,
  subject: string,
  content: string,
  attachmentPaths: string[]
) {

  const {
    ZOHO_MAIL_API_DOMAIN,
    ZOHO_MAIL_ACCOUNT_ID,
    ZOHO_MAIL_FROM_ADDRESS,
  } = process.env as any;

  if (!ZOHO_MAIL_API_DOMAIN || !ZOHO_MAIL_ACCOUNT_ID || !ZOHO_MAIL_FROM_ADDRESS) {
    console.error(
      'Missing ZOHO_MAIL_API_DOMAIN / ZOHO_MAIL_ACCOUNT_ID / ZOHO_MAIL_FROM_ADDRESS in .env — cannot send email.'
    );
    return;
  }

  const attachments: { storeName: string; attachmentPath: string; attachmentName: string }[] = [];

  for (const filePath of attachmentPaths) {

    if (!fs.existsSync(filePath)) {
      console.warn(`Report file not found, skipping attachment: ${filePath}`);
      continue;
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const uploadRes = await fetch(
      `${ZOHO_MAIL_API_DOMAIN}/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages/attachments?fileName=${encodeURIComponent(fileName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: fileBuffer,
      }
    );

    const uploadData: any = await uploadRes.json();
    const info = uploadData?.data;

    if (!uploadRes.ok || !info) {
      console.error('Mail attachment upload failed:', uploadData);
      continue;
    }

    attachments.push({
      storeName: info.storeName,
      attachmentPath: info.attachmentPath,
      attachmentName: fileName,
    });
  }

  const sendRes = await fetch(
    `${ZOHO_MAIL_API_DOMAIN}/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAddress: ZOHO_MAIL_FROM_ADDRESS,
        toAddress,
        subject,
        content,
        attachments,
      }),
    }
  );

  const sendData: any = await sendRes.json();

  if (!sendRes.ok) {
    console.error('Send email failed:', sendData);
    throw new Error('Failed to send email');
  }

  console.log(`Email sent to ${toAddress}`);

  return sendData;
}