// run-task-test.ts

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { chromium } from '@playwright/test';

import { getTicket, getAccessToken, replyToTicket } from './fetch-ticket';
import { getTask } from './fetch-task';
import { sendEmailWithReport } from './zoho-mail';


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


function ask(question: string): Promise<string> {

  return new Promise(resolve => {

    rl.question(question, answer => {

      resolve((answer || '').trim());

    });

  });

}



function sanitizePastedSteps(raw: string): string {

  let lines = raw.split('\n');


  lines = lines.filter(line =>
    !line.includes("import { test, expect } from '@playwright/test'")
  );


  const testStart = lines.findIndex(line =>
    line.trim().startsWith('test(')
  );


  if(testStart !== -1){

    lines.splice(testStart,1);


    for(let i = lines.length - 1; i >= 0; i--){

      if(lines[i].trim() === '});'){

        lines.splice(i,1);
        break;

      }

    }

  }


  while(lines.length && lines[0].trim()==='')
    lines.shift();


  while(lines.length && lines[lines.length-1].trim()==='')
    lines.pop();


  return lines.join('\n');

}




function collectSteps(): Promise<string>{

  console.log('\nPaste Playwright steps.');
  console.log('Type END on a new line after finishing.\n');


  const lines:string[]=[];


  return new Promise(resolve=>{


    const listener=(line:string)=>{


      if(line.trim()==='END'){

        rl.removeListener('line',listener);

        resolve(lines.join('\n'));

      }
      else{

        lines.push(line);

      }


    };


    rl.on('line',listener);


  });


}



// Text shown on the target site when login fails. Matched
// case-insensitively as a substring, so partial matches still work.
const LOGIN_ERROR_SNIPPETS = [
  'login not created',
  'invalid credentials',
  'kindly contact hr',
];


/**
 * Attempts a real login with a headless browser and checks the page
 * for a known "wrong credentials" message. Returns true if login
 * looks successful (none of the error snippets were found).
 */
async function checkCredentials(
  url: string,
  username: string,
  password: string
): Promise<boolean> {

  const browser = await chromium.launch();

  try {

    const page = await browser.newPage();

    await page.goto(url);

    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForLoadState('networkidle').catch(() => {});

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const lower = bodyText.toLowerCase();

    const hasError = LOGIN_ERROR_SNIPPETS.some(snippet => lower.includes(snippet));

    return !hasError;

  } finally {

    await browser.close();

  }

}




async function main(){


console.log('\n=================================');
console.log('ZOHO DESK TEST AUTOMATION');
console.log('=================================\n');



const ticketArg =
process.argv.find(a=>a.startsWith('--ticket='));


const taskArg =
process.argv.find(a=>a.startsWith('--task='));



let sourceType:'ticket'|'task';

let sourceId:string;



if(ticketArg){

sourceType='ticket';

sourceId=ticketArg.split('=')[1];

}

else if(taskArg){

sourceType='task';

sourceId=taskArg.split('=')[1];

}

else{


const type =
await ask('Ticket or Task? ');


sourceType =
type.toLowerCase().startsWith('task')
?'task'
:'ticket';



sourceId =
await ask('Enter ID: ');


}




let subject='';

let description='';

let requesterEmail='';



console.log('\nFetching...');

if(sourceType==='ticket'){


const ticket =
await getTicket(sourceId);


subject=ticket.subject;

description=ticket.description;

requesterEmail =
ticket.requesterEmail || '';



}

else{


const task =
await getTask(sourceId);



subject=task.subject;

description=task.description;

requesterEmail =
(task as any).requesterEmail || '';

}



console.log('\n============== REQUIREMENTS ==============');

console.log(subject);

console.log('------------------------------------------');

console.log(description);

console.log('==========================================\n');




const urlMatch =
description.match(/https?:\/\/\S+/);



const detectedUrl =
urlMatch
?
urlMatch[0].replace(/[.,]+$/,'')
:
'';



const url =
await ask(
`URL ${detectedUrl ? `[Enter=${detectedUrl}]` : ''}: `
)
|| detectedUrl;



if(!url){

console.error('URL missing');

process.exit(1);

}



// ---- Credential loop: keep asking until login actually succeeds ----

let username = '';
let password = '';
let credentialsValid = false;


while(!credentialsValid){

  username = await ask('Username: ');
  password = await ask('Password: ');

  console.log('\nChecking Credentials...');

  credentialsValid = await checkCredentials(url, username, password);

  if(!credentialsValid){

    console.log('❌ Wrong. Please try again.\n');

  }
  else{

    console.log('✅ Success\n');

  }

}




const reportTitle =
await ask(
`Report title [Enter=${subject}]: `
)
|| subject;



const rawSteps =
await collectSteps();



if(!rawSteps.trim()){

console.error('No steps provided');

process.exit(1);

}



const steps =
sanitizePastedSteps(rawSteps);




const safeName =
`${sourceType}-${sourceId}`
.replace(/[^a-zA-Z0-9-]/g,'_');



const specName =
`generated-${safeName}.spec.ts`;


const specPath =
path.join(process.cwd(),specName);




const formattedSteps =
steps
.split('\n')
.map(line=>'    '+line)
.join('\n');






const specContent = `

import 'dotenv/config';

import { test } from '@playwright/test';



test(${JSON.stringify(reportTitle)}, async ({page}, testInfo)=>{



await testInfo.attach('report-meta',{

body: JSON.stringify({

formTitle:${JSON.stringify(reportTitle)},

websiteUrl:${JSON.stringify(url)},

sourceType:${JSON.stringify(sourceType)},

sourceId:${JSON.stringify(sourceId)},

subject:${JSON.stringify(subject)},

description:${JSON.stringify(description)},

requesterEmail:${JSON.stringify(requesterEmail)}

}),

contentType:'application/json'

});




await test.step('Login',async()=>{


await page.goto(${JSON.stringify(url)});


await page
.getByRole('textbox',{name:'Username'})
.fill(${JSON.stringify(username)});


await page
.getByRole('textbox',{name:'Password'})
.fill(${JSON.stringify(password)});


await page
.getByRole('button',{name:'Sign In'})
.click();



await page.waitForLoadState('networkidle');


});




await test.step('Test Steps',async()=>{


${formattedSteps}


});





await test.step('Capture Screenshot',async()=>{


const screenshot =
await page.screenshot({
fullPage:true
});


await testInfo.attach(
'Final Screenshot',
{
body:screenshot,
contentType:'image/png'
}
);



});



});

`;



fs.writeFileSync(
specPath,
specContent,
'utf8'
);



console.log(`\nGenerated test: ${specName}`);



// ---- Run Playwright Test ----
// (custom-report.ts is registered as a reporter and generates the
// PDF + Excel files itself once the test run finishes, before this
// process continues below)

let testPassed = true;


try{


execSync(
`npx playwright test "${specName}"`,
{
stdio:'inherit'
}
);



console.log('\nExecution completed');


}
catch{

testPassed = false;

console.log(
'\nExecution failed. Report will still be generated.'
);


}



// ---- Locate the generated PDF / Excel reports ----
// NOTE: this assumes custom-report.ts writes to these exact paths.
// If your generatePDF/generateExcel implementation names files
// differently, update the two lines below to match.

const date = new Date();

const fileDate =
[
  String(date.getDate()).padStart(2,'0'),
  String(date.getMonth()+1).padStart(2,'0'),
  date.getFullYear()
].join('-');

const outDir = 'test-results';

const pdfPath = path.join(outDir, `report-${fileDate}.pdf`);
const excelPath = path.join(outDir, `report-${fileDate}.xlsx`);

const reportAttachments = [pdfPath, excelPath].filter(p => fs.existsSync(p));

if(reportAttachments.length < 2){
  console.warn(
    '\n⚠️  Could not find both report files at the expected paths:\n' +
    `   ${pdfPath}\n   ${excelPath}\n` +
    'Adjust the paths above if generatePDF/generateExcel write elsewhere.\n'
  );
}


const summary =
`Automated test "${reportTitle}" ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}.\n\n` +
`Please find the detailed PDF and Excel reports attached.`;



// ---- Reply Ticket ----
// (Zoho Desk tasks don't have a reply/conversation thread the way
// tickets do, so this step only applies when sourceType is 'ticket')

if(sourceType === 'ticket'){

  console.log('\nReplying to ticket...');

  try{

    const accessToken = await getAccessToken();

    await replyToTicket(
      sourceId,
      accessToken,
      summary.replace(/\n/g,'<br>'),
      reportAttachments.map(p => ({ path: p, name: path.basename(p) }))
    );

    console.log('Ticket reply sent.');

  }
  catch(err){

    console.error('Failed to reply to ticket:', err);

  }

}
else{

  console.log('\nSkipping ticket reply (source is a task, not a ticket).');

}



// ---- Send Email ----

const emailTo = await ask('\nEnter email address to send the report to: ');


if(emailTo){

  console.log('Sending email...');

  try{

    const accessToken = await getAccessToken();

    await sendEmailWithReport(
      accessToken,
      emailTo,
      reportTitle,
      summary.replace(/\n/g,'<br>'),
      reportAttachments
    );

  }
  catch(err){

    console.error('Failed to send email:', err);

  }

}
else{

  console.log('No email address entered, skipping email step.');

}



console.log(
'\nCheck test-results folder.'
);


rl.close();


}



main()
.catch(err=>{


console.error(err);

rl.close();

process.exit(1);


});