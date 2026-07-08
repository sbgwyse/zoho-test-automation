// fetch-task.ts
//
// Fetches a Zoho Desk TASK (Activities > Tasks module) by ID.
// Unlike tickets, a task's description lives directly on the task object —
// there's no separate conversations/threads lookup needed.
//
// Usage:
//   npx ts-node fetch-task.ts --task=207801000006357001

import 'dotenv/config';
import fetch from 'node-fetch';

async function getAccessToken(): Promise<string> {
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_DOMAIN } = process.env as any;
  const tokenRes = await fetch(
    `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const tokenData: any = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error('Failed to get access token:', tokenData);
    process.exit(1);
  }
  return tokenData.access_token;
}

async function fetchTaskData(taskId: string, accessToken: string) {
  const { ZOHO_API_DOMAIN, ZOHO_ORG_ID } = process.env as any;

  const taskRes = await fetch(`${ZOHO_API_DOMAIN}/api/v1/tasks/${taskId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, orgId: ZOHO_ORG_ID, 'Accept-Encoding': 'identity' },
  });
  const taskData: any = await taskRes.json();
  if (!taskRes.ok) {
    console.error('Task fetch failed:', taskData);
    process.exit(1);
  }

  // Zoho Desk task fields: id, subject, description, status, priority,
  // dueDate, ticketId (if linked to a ticket), ownerId, departmentId, etc.
  return {
    id: taskData.id,
    subject: taskData.subject || '',
    description: (taskData.description || '').trim(),
    status: taskData.status || '',
    priority: taskData.priority || '',
    dueDate: taskData.dueDate || null,
    linkedTicketId: taskData.ticketId || null,
  };
}

export async function getTask(taskId: string) {
  const accessToken = await getAccessToken();
  return fetchTaskData(taskId, accessToken);
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--task='));
  if (!arg) {
    console.error('Missing --task=<id> argument.');
    process.exit(1);
  }
  const taskId = arg.split('=')[1];

  console.log('Getting access token...');
  const accessToken = await getAccessToken();
  console.log('Access token obtained.');
  console.log(`Fetching task #${taskId}...`);
  const task = await fetchTaskData(taskId, accessToken);

  require('fs').writeFileSync('task-content.txt', task.description, 'utf-8');

  console.log('\n================ TASK FOUND ================');
  console.log('ID          :', task.id);
  console.log('Subject     :', task.subject);
  console.log('Status      :', task.status);
  console.log('Priority    :', task.priority);
  console.log('Due Date    :', task.dueDate || '(none)');
  console.log('Linked Ticket:', task.linkedTicketId || '(none)');
  console.log('\nDescription:\n', task.description || '(none)');
  console.log('================================================\n');
  console.log('Full description saved to task-content.txt');
}

if (require.main === module) {
  main().catch((err) => { console.error('Error:', err); process.exit(1); });
}