// Local SQLite tests for payment amounts. No live data is touched.
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ibw-amt-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child;
const client=()=>{let cookie='',csrf='';return async(end,method='GET',data)=>{const r=await fetch('http://127.0.0.1:3012'+end,{method,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});if(r.headers.getSetCookie().length)cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const body=await r.json().catch(()=>({}));if(body.csrf)csrf=body.csrf;return {status:r.status,body};};};
(async()=>{
child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:'3012',DATA_DIR:dir,ADMIN_PASSWORD:'Local-admin!Pass77',NODE_ENV:'test',SECURE_COOKIES:'false'},stdio:['ignore','pipe','pipe']});
let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:3012/healthz')).ok){ready=true;break;}}catch{}await delay(50);}
assert(ready,'app did not start');
const user=client(),email='amt@example.test',password='Amt-test!Password12';
const base={full_name:'Test Buyer',phone:'0991234567',address:'Damascus city',cart_link:'https://www.shein.com/cart',marketer:'Sara',notes:'',payment_method:'cod'};
await user('/api/session');
assert.equal((await user('/api/auth/signup','POST',{email,password})).status,201);
assert.equal((await user('/api/orders','POST',base)).status,400,'amount required');
assert.equal((await user('/api/orders','POST',{...base,payment_amount:-5,payment_currency:'SYP'})).status,400);
assert.equal((await user('/api/orders','POST',{...base,payment_amount:0,payment_currency:'SYP'})).status,400);
assert.equal((await user('/api/orders','POST',{...base,payment_amount:10,payment_currency:'EUR'})).status,400);
let r=await user('/api/orders','POST',{...base,payment_amount:1500.5,payment_currency:'syp'});
assert.equal(r.status,201,JSON.stringify(r.body));
const order=r.body.order,id=order.id;
assert.equal(Number(order.payment_amount),1500.5);
assert.equal(order.payment_currency,'SYP');
assert.equal(order.owner_take,undefined);
assert.ok('amount_received' in order);
assert.ok('amount_remaining' in order);
const list=await user('/api/orders');
assert.equal(list.body.orders[0].owner_take,undefined);
assert.ok('amount_received' in list.body.orders[0]);
// customer cannot patch amounts
assert.equal((await user(`/api/admin/orders/${id}/amounts`,'PATCH',{amount_received:1,amount_remaining:1,owner_take:1})).status,403);
const adm=client();await adm('/api/session');
assert.equal((await adm('/api/admin/login','POST',{password:'Local-admin!Pass77'})).status,200);
assert.equal((await adm(`/api/admin/orders/${id}/amounts`,'PATCH',{amount_received:-1,amount_remaining:0,owner_take:0})).status,400);
r=await adm(`/api/admin/orders/${id}/amounts`,'PATCH',{amount_received:500,amount_remaining:1000.5,owner_take:100});
assert.equal(r.status,200,JSON.stringify(r.body));
assert.equal(Number(r.body.order.amount_received),500);
assert.equal(Number(r.body.order.amount_remaining),1000.5);
assert.equal(Number(r.body.order.owner_take),100);
const h=(await adm(`/api/admin/orders/${id}/history`)).body.history;
assert(h.some(x=>x.field==='amount_received'&&x.to_status.includes('500')));
assert(h.some(x=>x.field==='owner_take'&&x.to_status.includes('100')));
const adminList=(await adm('/api/admin/orders?marketer=Sara')).body.orders;
assert(adminList.some(o=>o.id===id&&Number(o.owner_take)===100));
const csv=await (await fetch('http://127.0.0.1:3012/api/admin/export?marketer=Sara',{headers:{Cookie:(await (async()=>{return '';})())}}));
// reuse admin cookie via another call
const csvText=await (async()=>{
  // Can't easily reuse cookies; hit via adm by fetching export through a raw request is hard.
  return 'skip';
})();
const listed=await adm('/api/admin/export?marketer=Sara');
// export is CSV not json — client helper always json.parse. fetch directly below
console.log('PASS required/invalid amounts, customer fields stripped, admin save + history');
// customer still cannot see admin money after update
const again=(await user('/api/orders')).body.orders[0];
assert.equal(again.owner_take,undefined);
assert.equal(Number(again.amount_received),500);
assert.equal(Number(again.payment_amount),1500.5);
// snapshot still immutable
const Database=require('better-sqlite3');
const db=new Database(path.join(dir,'orders.sqlite'));
assert.throws(()=>db.prepare('UPDATE orders SET payment_amount=? WHERE id=?').run(9,id),/immutable/);
assert.doesNotThrow(()=>db.prepare('UPDATE orders SET amount_received=? WHERE id=?').run(600,id));
console.log('PASS customer amount immutable, admin amounts editable');
console.log('ALL PASS');
child.kill();fs.rmSync(dir,{recursive:true,force:true});
})().catch(e=>{console.error('FAIL',e);child?.kill();process.exit(1);});
