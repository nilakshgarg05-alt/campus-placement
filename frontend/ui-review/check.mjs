import { puppeteer } from 'file:///C:/Users/admin/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();
const errors=[]; const writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
const student={student_id:1,name:'Aarav Sharma',branch:'CSE',cgpa:8.6,backlogs:0,email:'aarav@example.com'};
const job={job_id:1,company_id:1,company_name:'Example Technologies',job_title:'Software Engineer',min_cgpa:7,max_backlogs:0,eligible_branches:'CSE, IT',skills:['React','Python'],job_description:'Build thoughtful software with a collaborative engineering team.'};
page.on('request', req=>{
 const url=new URL(req.url());
 if(url.origin==='http://127.0.0.1:5173') return req.continue();
 if(req.resourceType()==='font'||req.resourceType()==='stylesheet') return req.abort();
 const p=url.pathname;
 let data={};
 if(req.method()==='POST') writes.push({path:p,body:JSON.parse(req.postData()||'{}')});
 if(p==='/students') data=[student];
 else if(p==='/companies') data=[{company_id:1,company_name:'Example Technologies'}];
 else if(p==='/jobs') data=[job];
 else if(p==='/tpo/dashboard') data={total_students:120,total_companies:18,total_jobs:32,total_applications:240,shortlisted_students:64,placed_students:48};
 else if(p==='/tpo/company-statistics') data={companies:[{company_id:1,company_name:'Example Technologies',total_jobs:3,total_applications:24,placed_students:8}]};
 else if(p==='/tpo/job-statistics') data={jobs:[job]};
 else if(p==='/tpo/student-status') data={students:[student]};
 else if(p==='/placement-assistant') data={answer:'Check the role eligibility criteria and prepare examples of your project work.'};
 else if(p==='/recruiter/jobs') data={job_id:42};
 else if(p.includes('applications')) data={applications:[]};
 req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'},body:JSON.stringify(data)});
});
const pause=()=>new Promise(r=>setTimeout(r,450));
async function overflow(label){const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert(sizes.scroll<=sizes.viewport+1,`${label} overflow: ${JSON.stringify(sizes)}`);}
try {
 for(const width of [1440,390]) {
  await page.setViewport({width,height:1000,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:5173/'); await pause(); await overflow('home '+width);
  await page.screenshot({path:`ui-review/home-${width}.png`,fullPage:true});
  for(const role of ['recruiter','student','tpo']) {
   await page.goto('http://127.0.0.1:5173/'+role);await page.waitForSelector('.nav-item');await pause();
   const count=await page.$$eval('.nav-item',els=>els.length);
   for(let i=0;i<count;i++) {
    await page.$$eval('.nav-item',(els,i)=>els[i].click(),i);await pause();
    assert(await page.$('#dashboard-content'),'main missing');await overflow(`${role} tab ${i} width ${width}`);
    if(i===0||i===count-1) await page.screenshot({path:`ui-review/${role}-${i}-${width}.png`,fullPage:true});
   }
  }
 }
 await page.setViewport({width:1440,height:1000});
 await page.goto('http://127.0.0.1:5173/recruiter');await page.waitForSelector('select[name="company_id"] option[value="1"]');
 await page.select('[name="company_id"]','1');
 for(const [name,value] of Object.entries({job_title:'Frontend Engineer',min_cgpa:'7',max_backlogs:'0',eligible_branches:'CSE, IT',job_description:'Build accessible interfaces.',skills:'React, Python'})) await page.type(`[name="${name}"]`,value);
 await page.click('button[type="submit"]');await page.waitForSelector('.toast-success');
 assert.deepEqual(writes.find(x=>x.path==='/recruiter/jobs').body,{company_id:1,job_title:'Frontend Engineer',min_cgpa:7,max_backlogs:0,eligible_branches:'CSE, IT',job_description:'Build accessible interfaces.',skills:['React','Python']});
 await page.goto('http://127.0.0.1:5173/student');await page.waitForSelector('.nav-item');
 await page.$$eval('.nav-item',els=>els.at(-1).click());await page.waitForSelector('.chat-composer');
 await page.type('.chat-composer input','How should I prepare?');await page.click('.chat-composer button');
 await page.waitForFunction(()=>document.querySelectorAll('.chat-message').length===3);
 assert.equal(writes.find(x=>x.path==='/placement-assistant').body.question,'How should I prepare?');
 await page.screenshot({path:'ui-review/assistant-conversation.png',fullPage:true});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 assert.equal(await page.$eval('.chat-message',el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);
 console.log('PASS: landing and all 17 dashboard tabs at 1440px and 390px; no horizontal page overflow or runtime errors; job payload and chat request preserved; reduced motion respected. API responses mocked, no live data changed.');
} finally {await browser.close();}

