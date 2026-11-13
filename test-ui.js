// DOM-only unit tests: no browser, GUI, CDP, cookies from browser profiles, or desktop automation.
const {JSDOM,CookieJar,VirtualConsole}=require('jsdom');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
const script=fs.readFileSync('public/app.js','utf8'),html=fs.readFileSync('public/index.html','utf8').replace('<script defer src="/app.js"></script>','');
const jar=new CookieJar();
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:base+'/#/signup',runScripts:'outside-only',pretendToBeVisual:true,cookieJar:jar,virtualConsole:vc});
const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async(url,opts={})=>{const headers={...opts.headers};const cookie=jar.getCookieStringSync(base);if(cookie)headers.Cookie=cookie;const response=await fetch(new URL(url,base),{...opts,headers});for(const c of response.headers.getSetCookie())jar.setCookieSync(c,base);return response;};
w.eval(script);
const $=s=>w.document.querySelector(s);
const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out waiting for DOM state: '+String(fn));};
const change=(name,value)=>{const el=$(`[name="${name}"]`);assert(el,'Missing field '+name);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const submit=s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 await wait(()=>$('#auth-form'));assert.equal(w.document.documentElement.dir,'rtl');assert(w.document.body.textContent.includes('IBW Orders'));console.log('PASS signup Arabic RTL screen');
 change('email',`ui-${Date.now()}@example.test`);change('password','UI-test!Password34');submit('#auth-form');await wait(()=>$('#order-form'));console.log('PASS signup routes to authenticated order form');
 assert.equal($('[name=marketer]').value,'');assert.equal(w.document.querySelectorAll('[name=payment_method]').length,2);assert.equal($('[name=payment_method]:checked'),null);console.log('PASS customer-entered marketer, payment choice required with no prefill');
 change('full_name','سارة خالد — تجربة الواجهة');change('phone','+963 933 444 555');change('address','حلب، شارع الحديقة، البناء 8');change('cart_link','https://m.shein.com/cart/test');change('marketer','لينا');change('notes','طلب توضيحي لا يتضمن شراء حقيقياً');change('payment_amount','25000');
 submit('#order-form');await wait(()=>$('#error-payment_method')?.textContent.includes('اختاري'));assert.equal($('[name=payment_method]').getAttribute('aria-invalid'),'true');console.log('PASS inline Arabic missing payment validation');
 const radio=$('[name=payment_method][value=sham_cash]');radio.checked=true;radio.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal($('#sham-note').hidden,false);submit('#order-form');await wait(()=>$('.success-receipt'));assert($('.success-receipt').textContent.includes('شام كاش'));assert($('.success-receipt').textContent.includes('25'));console.log('PASS Sham Cash note, submit, receipt number and payment snapshot');
 w.location.hash='/orders';await wait(()=>$('.order-card'));assert($('.order-card').textContent.includes('شام كاش'));$('[data-details]').click();await wait(()=>$('.modal'));assert($('.modal').textContent.includes('حالة الدفع'));$('#close-modal').click();assert.equal($('.modal'),null);console.log('PASS own orders, payment status, accessible details dialog');
 w.location.hash='/new';await wait(()=>$('#order-form')&&$('[name=full_name]').value);assert.equal($('[name=full_name]').value,'سارة خالد — تجربة الواجهة');assert.equal($('[name=marketer]').value,'');assert.equal($('[name=payment_method]:checked'),null);console.log('PASS profile prefill excludes marketer and payment');
 $('#logout').click();await wait(()=>$('#auth-form'));assert.equal($('.bottom-nav'),null);assert.equal($('#password').type,'password');$('.eye-toggle').click();assert.equal($('#password').type,'text');console.log('PASS logout and password visibility control');
 assert.deepEqual(errors,[]);dom.window.close();console.log('All DOM UI tests passed. No visual/browser testing was performed.');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
