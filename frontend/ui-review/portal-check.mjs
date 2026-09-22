// UI smoke test with isolated API fixtures. Uses the browser tooling already installed on this workstation.
import { puppeteer } from 'file:///C:/Users/admin/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js';
import assert from 'node:assert/strict';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const errors = [];
const requests = [];
let policies = [];
let policyCounter = 0;
const staffProfiles = { recruiter: {company_id: 1, name: "Staff Member", organization: "Example Institute", designation: "Coordinator", phone: "12345"}, tpo: {name: "Staff Member", organization: "Example Institute", designation: "Coordinator", phone: "12345"} };
let student = { student_id: 1, name: 'Alice Student', email: 'alice@example.test', branch: 'CSE', cgpa: 8, backlogs: 0, phone: '', skills: ['Python'] };
const job = { job_id: 1, company_id: 1, company_name: 'Example Technologies', job_title: 'Engineer', min_cgpa: 7, max_backlogs: 0, eligible_branches: 'CSE, IT' };
page.on('pageerror', error => errors.push(error.message));
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (url.origin === 'http://localhost:5173') return request.continue();
  if (!url.pathname.startsWith('/auth') && !request.headers().authorization && request.method() !== 'OPTIONS') {
    if (['font', 'stylesheet'].includes(request.resourceType())) return request.abort();
  }
  const path = url.pathname;
  const method = request.method();
  const body = request.postData() && (request.headers()["content-type"] || "").includes("application/json") ? JSON.parse(request.postData()) : {};
  requests.push({ path, method, body, authorization: request.headers().authorization });
  let status = 200;
  let data = {};
  const token = request.headers().authorization?.replace('Bearer ', '');
  const role = token?.replace('-session', '');
  if (method === 'OPTIONS') data = {};
  else if (path === '/auth/login') {
    if (body.password !== 'correct-password') { status = 401; data = { detail: 'Invalid email or password' }; }
    else { const loginRole = body.email.split('@')[0]; data = { token: `${loginRole}-session`, account: { role: loginRole, student_id: loginRole === 'student' ? 1 : null } }; }
  } else if (path === '/auth/signup') {
    if (body.role !== 'student' && body.invitation_code !== 'valid-invite') { status = 403; data = { detail: 'Invalid invitation code for this role' }; }
    else { status = 201; data = { message: 'Account created', role: body.role }; }
  } else if (!token || token === 'expired') { status = 401; data = { detail: 'Your session has expired. Please sign in again' }; }
  else if (path === '/auth/me') data = { role, student_id: role === 'student' ? 1 : null, email: `${role}@example.test`, profile: staffProfiles[role] };
  else if (path === '/knowledge/policies') {
    if (method === 'POST') { const policy = {...body, document_id: `policy-${++policyCounter}`, revision:1, active:true, updated_at:new Date().toISOString()}; policies.push(policy); data=policy; status=201; }
    else data={policies};
  }
  else if (path.startsWith('/knowledge/policies/')) {
    const old=policies.find(item => item.document_id === path.split('/').at(-1));
    if (method === 'DELETE') { old.active=false; data={message:'Archived'}; }
    else { old.active=false; const next={...old,...body,document_id:`policy-${++policyCounter}`,revision:old.revision+1,active:true}; policies.push(next);data=next; }
  }
  else if (path === '/knowledge/files') { data={document_id:'requirements-draft'};status=201; }
  else if (path === '/knowledge/jobs/1') data={documents:[{document_id:'requirements',title:'Selection requirements',content:'Aptitude and technical interview.',revision:1}]};
  else if (path === '/recruiter/jobs') data={job_id:25};
  else if (path === '/placement-assistant') data={answer:'Attendance must be 80 percent [S1].',grounded:true,evidence:[{citation:'S1',title:'Attendance policy',kind:'campus',revision:2,excerpt:'Attendance must be 80 percent.'}],job_matches:[{...job,eligibility:{eligible:true}}]};
  else if (path === '/auth/profile') { staffProfiles[role] = {...staffProfiles[role], ...body}; data = {role, email: `${role}@example.test`, profile: staffProfiles[role]}; }
  else if (path === '/tpo/documents') data = {documents: [{kind: 'document', document_id: 'demo', filename: 'student-notes.txt', scope: 'student', student_id: 1, owner_name: 'Alice Student', owner_email: 'alice@example.test'}, {kind: 'document', document_id: 'recruiter-demo', filename: 'job-brief.txt', scope: 'recruiter', owner_name: 'Recruiter', owner_email: 'recruiter@example.test'}]};
  else if (path === '/tpo/documents/demo') data = {filename: 'student-notes.txt', text: 'Shared student notes'};
  else if (path === '/auth/logout') data = { message: 'Signed out' };
  else if (path === '/students/me') {
    if (method === 'PUT') student = { ...student, ...body };
    data = student;
  } else if (path === '/jobs') data = [job];
  else if (path === '/companies') data = [{ company_id: 1, company_name: 'Example Technologies' }];
  else if (path === '/jobs/1/matches') data = { required_skills: ['React'], matches: [{ ...student, skill_match: 100, matched_skills: ['React'], missing_skills: [] }] };
  else if (path === '/jobs/1/applications') data = { applications: [{ ...student, application_id: 1, status: 'Applied' }] };
  else if (path.includes('applications')) data = { applications: [] };
  else if (path === '/documents') data = { documents: [] };
  else if (path === '/tpo/dashboard') data = { total_students: 1, total_companies: 1, total_jobs: 1, total_applications: 1, shortlisted_students: 0, placed_students: 0 };
  else if (path === '/tpo/company-statistics') data = { companies: [] };
  else if (path === '/tpo/job-statistics') data = { jobs: [] };
  else if (path === '/tpo/student-status') data = { students: [student] };
  else { status = 404; data = { detail: `Unexpected fixture request: ${path}` }; }
  return request.respond({ status, contentType: 'application/json', headers: {
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  }, body: JSON.stringify(data) });
});
const pause = () => new Promise(resolve => setTimeout(resolve, 200));
async function clickText(selector, label) {
  await page.$$eval(selector, (elements, text) => {
    const found = elements.find(element => element.textContent.includes(text));
    if (!found) throw new Error(`Missing ${text}`);
    found.click();
  }, label);
}
async function fill(selector, value) {
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, value);
}
async function login(role) {
  await page.goto(`http://localhost:5173/${role}`);
  await page.waitForSelector('#login-email');
  await fill('#login-email', `${role}@example.test`);
  await fill('#login-password', 'correct-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item');
}
async function noOverflow(label) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert(size.scroll <= size.viewport + 1, `${label}: overflow ${JSON.stringify(size)}`);
}
try {
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    for (const role of ['student', 'recruiter', 'tpo']) {
      await page.goto(`http://localhost:5173/signup/${role}`);
      await page.waitForSelector('#signup-name');
      const fields = { name: 'New Campus User', email: `new-${role}@example.test`, phone: '9000000000',
        password: 'correct-password', confirm_password: 'correct-password' };
      if (role === 'student') Object.assign(fields, { branch: 'CSE', cgpa: '8.7', college: 'Example Institute',
        roll_number: 'CS2027', graduation_year: '2027', skills: 'Python, React', achievements: 'Hackathon winner',
        projects: 'Built a campus portal', certifications: 'Cloud fundamentals', github: 'https://github.com/example' });
      else Object.assign(fields, { organization: 'Example Organization', designation: 'Coordinator',
        department: 'Placement', website: 'https://example.test', invitation_code: 'valid-invite' });
      for (const [key,value] of Object.entries(fields)) await fill(`#signup-${key}`, value);
      await noOverflow(`${role} signup ${width}`);
      await page.screenshot({ path: `ui-review/signup-${role}-${width}.png`, fullPage: true });
      if (role === 'student') {
        await fill('#signup-confirm_password', 'different-password');
        await page.click('button[type=submit]');
        await page.waitForSelector('[role=alert]');
        assert(await page.$eval('[role=alert]', element => element.textContent.includes('Passwords do not match')));
        await fill('#signup-confirm_password', 'correct-password');
      }
      if (role === 'recruiter') {
        await fill('#signup-invitation_code', 'wrong-invite');
        await page.click('button[type=submit]');
        await page.waitForSelector('[role=alert]');
        await fill('#signup-invitation_code', 'valid-invite');
      }
      await page.click('button[type=submit]');
      await page.waitForSelector('[role=status]');
      assert(await page.$eval('[role=status]', element => element.textContent.includes('Your account is ready')));
      const sent = requests.filter(request => request.path === '/auth/signup' && request.method === 'POST').at(-1).body;
      assert.equal(sent.role, role);
      assert(!('confirm_password' in sent));
      if (role === 'student') { assert.equal(sent.cgpa, 8.7); assert.equal(sent.achievements, 'Hackathon winner'); assert.deepEqual(sent.skills, ['Python', 'React']); }
    }
  }
  await page.goto('http://localhost:5173/signup/student');
  await page.waitForSelector('#signup-name');
  await fill('#signup-name', 'Discard on role change');
  await page.click('a[href="/signup/recruiter"]');
  await page.waitForSelector('#signup-organization');
  assert.equal(await page.$eval('#signup-name', element => element.value), '');
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/student');
  await page.waitForSelector('#login-email');
  await fill('#login-email', 'student@example.test');
  await fill('#login-password', 'wrong-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('[role=alert]');
  assert.equal(await page.$('.nav-item'), null);
  await fill('#login-password', 'correct-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item');
  assert.equal(await page.$('[aria-label="Select student profile"]'), null);
  assert(!requests.some(request => request.path === '/students'));
  await clickText('.nav-item', 'My Profile');
  await page.waitForSelector('#profile-name');
  await fill('#profile-name', 'Alice Updated');
  await fill('#profile-skills', 'Python, React, SQL');
  await page.click('button[type=submit]');
  await page.waitForSelector('.toast-success');
  assert.equal(student.name, 'Alice Updated');
  assert.deepEqual(student.skills, ['Python', 'React', 'SQL']);
  const update = requests.find(request => request.path === '/students/me' && request.method === 'PUT');
  assert.equal(update.authorization, 'Bearer student-session');
  assert(!('student_id' in update.body));
  await page.reload();
  await page.waitForSelector('.nav-item');
  assert(await page.$eval('#dashboard-content', element => element.textContent.includes('Alice Updated')));
  await page.goto('http://localhost:5173/recruiter');
  await page.waitForFunction(() => location.pathname === '/student');
  await page.waitForSelector('.nav-item');
  await clickText('.header-actions button', 'Sign out');
  await page.waitForSelector('#login-email');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('campus-session')), null);

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    await page.screenshot({ path: `ui-review/login-${width}.png`, fullPage: true });
    await noOverflow(`login ${width}`);
    for (const role of ['student', 'recruiter', 'tpo']) {
      await login(role);
      const count = await page.$$eval('.nav-item', elements => elements.length);
      for (let index = 0; index < count; index++) {
        await page.$$eval('.nav-item', (elements, i) => elements[i].click(), index);
        await pause();
        await noOverflow(`${role} tab ${index}, ${width}`);
      }
      if (role !== 'student') {
        await clickText('.nav-item', 'My Profile');
        await page.waitForSelector('#staff-name');
        await fill('#staff-name', `Updated ${role}`);
        await page.click('button[type=submit]');
        await page.waitForSelector('[role=status]');
        assert.equal(staffProfiles[role].name, `Updated ${role}`);
      }
      if (role === 'tpo') {
        assert(!(await page.$$eval('.nav-item', els => els.map(el => el.textContent))).some(label => label.includes('Document Assistant')));
        await clickText('.nav-item', 'Campus Policies');
        await page.waitForSelector('#policy-title');
        await fill('#policy-title', 'Attendance policy');
        await fill('#policy-content', 'Attendance must be 75 percent.');
        await page.click('button[type=submit]');
        await page.waitForSelector('[role=status]');
        await clickText('article button', 'Edit policy');
        await fill('#policy-content', 'Attendance must be 80 percent.');
        await page.click('button[type=submit]');
        await page.waitForFunction(() => document.querySelector('#dashboard-content').textContent.includes('Version 2'));
        await page.screenshot({path:`ui-review/campus-policies-${width}.png`,fullPage:true});
        await clickText('article button', 'Archive policy');
        await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.includes('archived'));
      }
      if (role === 'recruiter') {
        assert(!(await page.$$eval('.nav-item', els => els.map(el => el.textContent))).some(label => label.includes('Document Assistant')));
        await clickText('.nav-item', 'Post Job');
        await page.waitForFunction(() => document.querySelector('#recruiter-field-1')?.value);
        assert.equal(await page.$('select[name=company_id]'), null);
        assert(await page.$eval('#recruiter-field-1', el => el.readOnly));
        for (const [name,value] of Object.entries({job_title:'Frontend Engineer',min_cgpa:'7',max_backlogs:'0',eligible_branches:'CSE',job_description:'Build software',skills:'React'})) await fill(`[name=${name}]`,value);
        const upload = await page.$('#job-requirements');
        await upload.uploadFile('C:/Users/admin/Downloads/campusplacement-professional-ui/campusplacement-fixed/frontend/ui-review/requirements-fixture.txt');
        await page.screenshot({path:`ui-review/job-policy-form-${width}.png`,fullPage:true});
        await page.click('button[type=submit]');
        await page.waitForSelector('.toast-success');
        const payload=requests.filter(req => req.path==='/recruiter/jobs' && req.method==='POST').at(-1).body;
        assert.deepEqual(payload.knowledge_document_ids,['requirements-draft']);
        assert(!Object.hasOwn(payload, 'company_id'));
      }
      if (role === 'student') {
        await clickText('.nav-item', 'Placement Assistant');
        await page.waitForSelector('#assistant-job option[value="1"]');
        await page.select('#assistant-job','1');
        await fill('.chat-composer input','What is the attendance policy?');
        await page.click('.chat-composer button');
        await page.waitForFunction(() => document.querySelector('#dashboard-content').textContent.includes('Retrieved sources'));
        assert(await page.$eval('#dashboard-content',el => el.textContent.includes('version 2')));
        assert.equal(requests.filter(req => req.path==='/placement-assistant' && req.method==='POST').at(-1).body.job_id,1);
        await noOverflow(`Grounded assistant ${width}`);
        await page.screenshot({path:`ui-review/grounded-assistant-${width}.png`,fullPage:true});
      }
      if (role === 'tpo') {
        await clickText('.nav-item', 'Student & Recruiter Uploads');
        await page.waitForFunction(() => document.querySelector('#dashboard-content').textContent.includes('student-notes.txt'));
        assert(await page.$eval('#dashboard-content', element => element.textContent.includes('job-brief.txt')));
        await clickText('article button', 'Preview text');
        await page.waitForFunction(() => document.querySelector('[aria-label="Document preview"]')?.textContent.includes('Shared student notes'));
        await page.select('[aria-label="Filter upload role"]', 'recruiter');
        assert.equal(await page.$$eval('article', elements => elements.length), 1);
        await noOverflow(`TPO uploads ${width}`);
      }
      if (role === 'student') {
        await clickText('.nav-item', 'My Profile');
        await page.screenshot({ path: `ui-review/profile-${width}.png`, fullPage: true });
      }
      if (role === 'recruiter') {
        await clickText('.nav-item', 'Skill Matches');
        await page.waitForSelector('#recruiter-field-8 option[value="1"]');
        await page.select('#recruiter-field-8', '1');
        await page.waitForFunction(() => document.querySelector('#dashboard-content').textContent.includes('Alice Updated'));
        assert(await page.$eval('#dashboard-content', element => element.textContent.includes('Python, React, SQL')));
        student = { ...student, name: 'Alice Latest' };
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => document.querySelector('#dashboard-content').textContent.includes('Alice Latest'));
        await page.select('#recruiter-field-8', '');
        await page.waitForFunction(() => !document.querySelector('#dashboard-content').textContent.includes('Alice Latest'));
        student = { ...student, name: 'Alice Updated' };
      }
      await clickText('.header-actions button', 'Sign out');
      await page.waitForSelector('#login-email');
    }
  }
  await page.evaluate(() => sessionStorage.setItem('campus-session', 'expired'));
  await page.goto('http://localhost:5173/student');
  await page.waitForSelector('#login-email');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('campus-session')), null);
  assert.deepEqual(errors, []);
  console.log('PASS: signup for all 3 roles at desktop/mobile, signup validation and payloads, login errors, role guards, own-profile save/reload, auth headers, logout/expiry, recruiter refresh, and every dashboard tab at 1440px and 390px. APIs mocked; no live data changed.');
} catch (error) {
  console.log(await page.$eval('body', element => element.innerText));
  console.log(requests.slice(-20).map(({path, method, body, authorization}) => ({path, method, correctPassword: body.password === 'correct-password', authorization})));
  throw error;
} finally { await browser.close(); }
