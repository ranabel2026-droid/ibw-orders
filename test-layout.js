// DOM/CSS regression tests; no browser automation and no real data changes.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),assert=require('assert/strict');
const css=fs.readFileSync('public/styles.css','utf8');
const html=fs.readFileSync('public/index.html','utf8').replace('<script defer src="/app.js"></script>','');
const dom=new JSDOM(html,{url:'http://127.0.0.1:3000/#/new',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(opts){this.lastScrollOptions=opts;};
let height=118,user={id:42,email:'layout@example.test'},observer=null,disconnects=0;
w.HTMLElement.prototype.getBoundingClientRect=function(){return {height:this.classList.contains('bottom-nav')?height:0};};
w.ResizeObserver=class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){disconnects++;}};
w.fetch=async(url,opts={})=>{if(url==='/api/auth/logout')user=null;return {ok:true,json:async()=>url==='/api/session'?{csrf:'layout-csrf',user,admin:false,smtpEnabled:false,config:{brand:'IBW Orders'}}:url==='/api/orders/prefill'?{profile:{}}:{ok:true}};};
const style=w.document.createElement('style');style.textContent=css;w.document.head.append(style);w.eval(fs.readFileSync('public/app.js','utf8'));
const $=s=>w.document.querySelector(s),wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('DOM layout state timeout');};
(async()=>{await wait(()=>$('#order-form'));assert.equal(w.document.documentElement.style.getPropertyValue('--bottom-nav-height'),'118px');assert(w.document.body.classList.contains('has-nav'));height=152;observer.fn();assert.equal(w.document.documentElement.style.getPropertyValue('--bottom-nav-height'),'152px');console.log('PASS navigation clearance tracks actual height, including safe-area growth');
const input=$('[name=cart_link]');input.focus();await wait(()=>input.lastScrollOptions);assert.equal(input.lastScrollOptions.block,'center');console.log('PASS focused form fields scroll above fixed navigation');
for(const selector of ['.field-hint','.steps-bar','.steps-bar b','.footer','.footer>span','.section-title p','.submit-area>p','.order-reassurance']){const el=$(selector);assert(el,'Missing helper '+selector);assert(parseFloat(w.getComputedStyle(el).fontSize)>=13,selector+' must be at least 13px');assert.equal(w.getComputedStyle(el).color,'rgb(83, 97, 75)');}console.log('PASS secondary helper, step and footer text minimum 13px with stronger contrast');
assert(css.includes('calc(12px + env(safe-area-inset-bottom,0px))'));assert(css.includes('padding-block-end:calc(var(--bottom-nav-height,104px) + var(--nav-clearance))'));assert(css.includes('.auth-story{height:auto;min-height:0;padding:14px 18px'));assert(css.includes('.auth-story h1 br,.auth-story p,.auth-story .story-art{display:none}'));console.log('PASS safe-area reservation and compact mobile hero rules');
$('#logout').click();await wait(()=>$('#auth-form'));assert.equal(w.document.documentElement.style.getPropertyValue('--bottom-nav-height'),'0px');assert(!w.document.body.classList.contains('has-nav'));assert(disconnects>0);console.log('PASS navigation spacing and resize observer clear after logout');w.close();})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
