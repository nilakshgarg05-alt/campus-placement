import { puppeteer } from 'file:///C:/Users/admin/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();
const requests=[];const errors=[];
const student={student_id:1,name:'Alice',email:'alice@chitkara.edu.in',branch:'CSE',cgpa:8,backlogs:0,skills:['Python','React']};
const job={job_id:1,company_name:'Acme',job_title:'Backend Engineer',min_cgpa:7,max_backlogs:0,eligible_branches:'CSE'};
const match={...job,matched_skills:['Python'],missing_skills:['React'],saved_skills_missing_from_resume:['React'],coverage:50,eligible:true,eligibility_blockers:[],next_steps:['Add a real React project example.']};
await page.evaluateOnNewDocument(()=>sessionStorage.setItem('campus-session','test-token'));
page.on('pageerror',e=>errors.push(e.message));
await page.setRequestInterception(true);
page.on('request',async request=>{
 const url=new URL(request.url());
 if(url.origin==='http://127.0.0.1:5173')return request.continue();
 if(url.origin!=='http://127.0.0.1:8000')return request.abort();
 if(request.method()==='OPTIONS')return request.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'}});
 const body=request.postData()?JSON.parse(request.postData()):{};
 requests.push({path:url.pathname,body});
 let result={};
 if(url.pathname==='/auth/me')result={role:'student',student_id:1,email:student.email};
 else if(url.pathname==='/students/me')result=student;
 else if(url.pathname==='/jobs')result=[job];
 else if(url.pathname==='/resume/recommendations')result={has_resume:true,recommendations:[match],other_jobs:[{...match,job_id:2,company_name:'Other',eligible:false,eligibility_blockers:['Minimum CGPA: 9']}],method:'Skill mentions, not selection probability.'};
 else if(url.pathname==='/resume/generate')result={resume:'# Alice\nPython backend project',target_job:job,target_fit:match};
 else if(url.pathname==='/knowledge/jobs/1')result={documents:[]};
 if(url.pathname==='/resume/generate-pdf')return request.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/pdf',body:'%PDF-1.4\nTest'});
 await request.respond({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},contentType:'application/json',body:JSON.stringify(result)});
});
async function clickText(selector,text){await page.$$eval(selector,(els,text)=>els.find(e=>e.textContent.includes(text))?.click(),text);}
try{
 for(const width of [1440,390]){
  await page.setViewport({width,height:1000});await page.goto('http://127.0.0.1:5173/student');
  await page.waitForSelector('.nav-item');await clickText('.nav-item','Resume AI');
  await page.waitForFunction(()=>document.body.textContent.includes('Where your resume fits'));
  await page.waitForFunction(()=>document.body.textContent.includes('Acme'));
  assert(await page.$eval('#dashboard-content',e=>e.textContent.includes('50%')));
  await clickText('button','Show other jobs');
  assert(await page.$eval('#dashboard-content',e=>e.textContent.includes('Minimum CGPA: 9')));
  await clickText('button','Build a resume for this job');
  await page.waitForSelector('#resume-target-job');
  assert.equal(await page.$eval('#resume-target-job',e=>e.value),'1');
  await clickText('button','Generate Resume');
  await page.waitForFunction(()=>document.querySelector('.ai-text')?.textContent.includes('Python backend project'));
  assert.equal(requests.filter(r=>r.path==='/resume/generate').at(-1).body.job_id,1);
  await clickText('button','Download PDF');
  await page.waitForResponse(r=>r.url().includes('/resume/generate-pdf') && r.request().method()==='POST');
  assert.equal(requests.filter(r=>r.path==='/resume/generate-pdf').at(-1).body.resume_text,'# Alice\nPython backend project');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.screenshot({path:`ui-review/resume-target-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: recommendations, gaps, targeted handoff, builder request, exact preview PDF, desktop/mobile layout. APIs mocked; no live data changed.');
}finally{await browser.close();}
