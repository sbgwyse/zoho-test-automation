import 'dotenv/config';
import fetch from 'node-fetch';
import * as fs from 'fs';
import FormData from 'form-data';


export async function getAccessToken(): Promise<string> {

  const {
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN,
    ZOHO_ACCOUNTS_DOMAIN
  } = process.env as any;


  const tokenRes = await fetch(
    `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    {
      method: 'POST'
    }
  );


  const tokenData:any = await tokenRes.json();


  if(!tokenData.access_token){

    console.error(
      'Failed to get access token:',
      tokenData
    );

    process.exit(1);

  }


  return tokenData.access_token;

}




async function fetchTicketData(
  ticketId:string,
  accessToken:string
){

  const {
    ZOHO_API_DOMAIN,
    ZOHO_ORG_ID
  } = process.env as any;



  const ticketRes = await fetch(

    `${ZOHO_API_DOMAIN}/api/v1/tickets/${ticketId}`,

    {
      headers:{
        Authorization:
        `Zoho-oauthtoken ${accessToken}`,

        orgId:
        ZOHO_ORG_ID,

        'Accept-Encoding':
        'identity'
      }
    }

  );



  const ticketData:any =
    await ticketRes.json();



  if(!ticketRes.ok){

    console.error(
      'Ticket fetch failed:',
      ticketData
    );

    process.exit(1);

  }




  const convRes = await fetch(

    `${ZOHO_API_DOMAIN}/api/v1/tickets/${ticketId}/conversations`,

    {
      headers:{
        Authorization:
        `Zoho-oauthtoken ${accessToken}`,

        orgId:
        ZOHO_ORG_ID,

        'Accept-Encoding':
        'identity'
      }
    }

  );



  const convData:any =
    await convRes.json();



  const conversations =
    convData.data || [];



  const description =
    conversations

    .map(
      (c:any)=>
      (c.summary || '').trim()
    )

    .filter(Boolean)

    .join('\n---\n');





  return {

    id:
    ticketData.id,


    subject:
    ticketData.subject || '',


    description,


    requesterEmail:

      ticketData.email ||

      ticketData.contact?.email ||

      ticketData.requester?.email ||

      ''

  };

}





export async function getTicket(
  ticketId:string
){

  const accessToken =
    await getAccessToken();


  return fetchTicketData(
    ticketId,
    accessToken
  );

}



/**
 * Posts the automation summary back to a Zoho Desk ticket, with the
 * generated PDF/Excel reports attached, as an email reply to the
 * ticket thread (visible to the requester and logged on the ticket).
 *
 * Flow:
 *  1. Upload each attachment to the ticket via the attachments API.
 *  2. Send a reply on the ticket referencing the uploaded attachment ids.
 */
export async function replyToTicket(
  ticketId: string,
  accessToken: string,
  content: string,
  attachments: { path: string; name: string }[]
) {

  const { ZOHO_API_DOMAIN, ZOHO_ORG_ID } = process.env as any;

  const attachmentIds: string[] = [];

  for (const att of attachments) {

    if (!fs.existsSync(att.path)) {
      console.warn(`Attachment not found, skipping: ${att.path}`);
      continue;
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(att.path), att.name);

    const uploadRes = await fetch(
      `${ZOHO_API_DOMAIN}/api/v1/tickets/${ticketId}/attachments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: ZOHO_ORG_ID,
          ...form.getHeaders(),
        },
        body: form as any,
      }
    );

    const uploadText = await uploadRes.text();
    let uploadData: any = {};

    try {
      uploadData = uploadText ? JSON.parse(uploadText) : {};
    } catch {
      uploadData = { raw: uploadText };
    }

    if (!uploadRes.ok || !uploadData.id) {
      console.error(
        `Attachment upload failed for ${att.name} (status ${uploadRes.status}):`,
        uploadData
      );
      continue;
    }

    attachmentIds.push(uploadData.id);
  }

  const replyRes = await fetch(
    `${ZOHO_API_DOMAIN}/api/v1/tickets/${ticketId}/sendReply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: ZOHO_ORG_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'EMAIL',
        contentType: 'html',
        content,
        attachmentIds: attachmentIds,
      }),
    }
  );

  const replyText = await replyRes.text();
  let replyData: any = {};

  try {
    replyData = replyText ? JSON.parse(replyText) : {};
  } catch {
    replyData = { raw: replyText };
  }

  if (!replyRes.ok) {
    console.error(`Ticket reply failed (status ${replyRes.status}):`, replyData);
    throw new Error('Failed to reply to ticket');
  }

  return replyData;
}




async function main(){


  const arg =
    process.argv.find(
      a=>a.startsWith('--ticket=')
    );


  if(!arg){

    console.error(
      'Missing --ticket=<id> argument.'
    );

    process.exit(1);

  }



  const ticketId =
    arg.split('=')[1];



  console.log(
    'Getting access token...'
  );


  const accessToken =
    await getAccessToken();



  console.log(
    'Access token obtained.'
  );



  console.log(
    `Fetching ticket #${ticketId}...`
  );



  const ticket =
    await fetchTicketData(
      ticketId,
      accessToken
    );



  require('fs')
    .writeFileSync(
      'ticket-content.txt',
      ticket.description,
      'utf-8'
    );



  console.log(
    '\n================ TICKET FOUND ================'
  );


  console.log(
    'ID:',
    ticket.id
  );


  console.log(
    'Subject:',
    ticket.subject
  );


  console.log(
    'Requester Email:',
    ticket.requesterEmail
  );


  console.log(
    '\nContent:\n',
    ticket.description || '(none)'
  );


  console.log(
    '================================================'
  );


}



if(require.main === module){

  main()
  .catch(err=>{

    console.error(
      'Error:',
      err
    );

    process.exit(1);

  });

}