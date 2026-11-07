// DOM-only admin regression tests, not browser automation.
const {JSDOM,CookieJar,VirtualConsole}=require('jsdom');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:3000',jar=new CookieJar();
const html=fs.readFileSync('public/index.html','utf8').replace('<script defer src="/app.js"></script>','');
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:base+'/admin',runScripts:'outside-only',pretendToBeVisual:true,cookieJar:jar,virtualConsole:vc}),w=dom.window;
w.scrollTo=()=>{};w.fetch=async(url,opts={})=>{const headers={...opts.headers},cookie=jar.getCookieStringSync(base);if(cookie)headers.Cookie=cookie;const r=await fetch(new URL(url,base),{...opts,headers});for(const c of r.headers.getSetCookie())jar.setCookieSync(c,base);return r;};
w.eval(fs.readFileSync('public/app.js','utf8'));
const $=s=>w.document.querySelector(s),wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('DOM state timed out');};
(async()=>{await wait(()=>$('#admin-login'));$('#password').value=process.env.ADMIN_PASSWORD||fs.readFileSync('ADMIN_PASSWORD.txt','utf8').trim();$('#admin-login').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>$('.admin-card'));assert($('#payment-filter'));assert($('[data-payment-status]'));console.log('PASS admin login, orders, payment filter and payment status controls');
$('#payment-filter').value='sham_cash';$('#payment-filter').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelectorAll('.admin-card').length&&[...w.document.querySelectorAll('.admin-payment-method')].every(x=>x.textContent.includes('شام كاش')));assert($('[data-details]'));$('[data-details]').click();await wait(()=>$('.history-item'));assert($('.modal').textContent.includes('حالة الدفع'));assert($('.modal').textContent.includes('شام كاش'));console.log('PASS admin filtered order details and audit timeline');
$('#close-modal').click();const pay=$('[data-payment-status]');const next=pay.value==='مدفوع'?'غير مدفوع':'مدفوع';pay.value=next;pay.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>$('#toast').textContent.includes('حالة الدفع'));console.log('PASS admin payment status saves successfully');assert.deepEqual(errors,[]);w.close();console.log('All admin DOM tests passed.');})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
