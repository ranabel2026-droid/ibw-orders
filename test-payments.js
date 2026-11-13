// Local SQLite tests for extra customer payments. No live data is touched.
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const Database=require('better-sqlite3');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ibw-pay-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child;
const client=()=>{let cookie='',csrf='';return async(end,method='GET',data)=>{const r=await fetch('http://127.0.0.1:3013'+end,{method,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});if(r.headers.getSetCookie().length)cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const ct=r.headers.get('content-type')||'';const body=ct.includes('json')?await r.json().catch(()=>({})):await r.text();if(body&&body.csrf)csrf=body.csrf;return {status:r.status,body,cookie};};};
(async()=>{
child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:'3013',DATA_DIR:dir,ADMIN_PASSWORD:'Local-admin!Pass77',NODE_ENV:'test',SECURE_COOKIES:'false'},stdio:['ignore','pipe','pipe']});
let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:3013/healthz')).ok){ready=true;break;}}catch{}await delay(50);}
assert(ready,'app did not start');
const user=client(),email='pay@example.test',password='Pay-test!Password12';
const base={full_name:'Test Buyer',phone:'0991234567',address:'Damascus city',cart_link:'https://www.shein.com/cart',marketer:'Lina',notes:'',payment_method:'cod',payment_amount:10000,payment_currency:'SYP'};
await user('/api/session');
assert.equal((await user('/api/auth/signup','POST',{email,password})).status,201);
let r=await user('/api/orders','POST',base);
assert.equal(r.status,201,JSON.stringify(r.body));
const id=r.body.order.id;
assert.equal(r.body.order.owner_take,undefined);
assert.ok('amount_received' in r.body.order);
assert.ok('amount_remaining' in r.body.order);

// amounts must be strictly positive — no zero, negative, or deduction entries
for(const bad of [0,-1,-50,'-10','']){
  const badR=await user(`/api/orders/${id}/payments`,'POST',{amount:bad,method:'cod'});
  assert.equal(badR.status,400,`expected 400 for amount=${bad} got ${badR.status}`);
}
console.log('PASS strictly positive payment amounts; zero and negatives rejected');

r=await user(`/api/orders/${id}/payments`,'POST',{amount:2500,method:'cod',note:'first extra'});
assert.equal(r.status,201,JSON.stringify(r.body));
const payId=r.body.payment.id;
assert.equal(r.body.payment.status,'pending');
assert.equal(Number(r.body.payment.amount),2500);
assert.equal(r.body.payment.currency,'SYP');

// customer cannot edit, reduce, cancel, or delete any payment including their own pending one
for(const [method,path] of [['PATCH',`/api/orders/${id}/payments/${payId}`],['PUT',`/api/orders/${id}/payments/${payId}`],['DELETE',`/api/orders/${id}/payments/${payId}`],['PATCH',`/api/orders/${id}/payments`],['DELETE',`/api/orders/${id}/payments`],['PATCH',`/api/admin/payments/${payId}`]]){
  const deny=await user(path,method,{status:'confirmed',amount:1,amount_received:0});
  assert.ok(deny.status===403||deny.status===401||deny.status===404,`customer ${method} ${path} should be denied, got ${deny.status}`);
}
const listed=(await user('/api/orders')).body.orders[0];
assert.equal(listed.payments.length,1);
assert.equal(listed.payments[0].status,'pending');
assert.equal(listed.pending_count,1);
assert.equal(listed.owner_take,undefined);
assert.ok('amount_received' in listed);
console.log('PASS customer can add but cannot edit, cancel, or delete payments (including pending)');

const adm=client();await adm('/api/session');
assert.equal((await adm('/api/admin/login','POST',{password:'Local-admin!Pass77'})).status,200);
const pendingList=(await adm('/api/admin/orders?pending_payments=1')).body.orders;
assert.ok(pendingList.some(o=>o.id===id&&Number(o.pending_count)>=1),'pending filter');

// reject keeps record, does not change received
r=await user(`/api/orders/${id}/payments`,'POST',{amount:300,method:'sham_cash',transfer_ref:'REF-9'});
assert.equal(r.status,201);
const rejectId=r.body.payment.id;
assert.equal((await adm(`/api/admin/payments/${rejectId}`,'PATCH',{status:'rejected',reason:'صورة غير واضحة'})).status,200);
let afterReject=(await user('/api/orders')).body.orders[0];
assert.equal(afterReject.payments.find(p=>p.id===rejectId).status,'rejected');
assert.equal(afterReject.payments.find(p=>p.id===rejectId).reason,'صورة غير واضحة');
assert.ok(afterReject.amount_received==null||Number(afterReject.amount_received)===0);

// confirm adds to received and recomputes remaining
r=await adm(`/api/admin/payments/${payId}`,'PATCH',{status:'confirmed'});
assert.equal(r.status,200,JSON.stringify(r.body));
assert.equal(Number(r.body.order.amount_received),2500);
assert.equal(Number(r.body.order.amount_remaining),7500);
assert.equal(r.body.order.owner_take==null||r.body.order.owner_take===undefined||r.body.order.owner_take===0,true);
const again=(await user('/api/orders')).body.orders[0];
assert.equal(Number(again.amount_received),2500);
assert.equal(Number(again.amount_remaining),7500);
assert.equal(again.owner_take,undefined);
assert.equal(again.payments.find(p=>p.id===payId).status,'confirmed');
assert.equal((await adm(`/api/admin/payments/${payId}`,'PATCH',{status:'confirmed'})).status,400,'already reviewed');
console.log('PASS confirm updates received/remaining; reject keeps record; owner take hidden from customer');

const db=new Database(path.join(dir,'orders.sqlite'));
assert.throws(()=>db.prepare('DELETE FROM payments WHERE id=?').run(payId),/permanent/);
assert.throws(()=>db.prepare('UPDATE payments SET amount=? WHERE id=?').run(1,payId),/immutable/);
console.log('PASS payments are append-only and amount snapshots are immutable');
console.log('ALL PASS');
child.kill();fs.rmSync(dir,{recursive:true,force:true});
})().catch(e=>{console.error('FAIL',e);child?.kill();process.exit(1);});
