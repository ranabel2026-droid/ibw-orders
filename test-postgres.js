// Contract and PostgreSQL grammar tests with a mocked pool. NOT a live PG integration test.
const assert=require('assert/strict'),{EventEmitter}=require('events');
const {parse}=require('pgsql-parser');
const pg=require('pg'),calls=[],pools=[];
class MockPool extends EventEmitter{
 constructor(options){super();this.options=options;pools.push(this);}
 async connect(){return {query:(sql,args)=>this.query(sql,args),release:()=>calls.push({sql:'RELEASE CLIENT'})};}
 async query(sql,args=[]){calls.push({sql,args});if(sql.includes('CREATE TABLE IF NOT EXISTS users'))return {rows:[],rowCount:0};if(sql.startsWith('INSERT INTO users'))return {rows:[{id:7}],rowCount:1};if(sql.startsWith('SELECT data FROM sessions'))return {rows:[{data:{userId:7,cookie:{expires:new Date(Date.now()+10000).toISOString()}}}],rowCount:1};if(sql.includes('FROM codes WHERE'))return {rows:[{id:1,hash:'valid-code-hash',expires:Date.now()+100000,attempts:0}],rowCount:1};if(sql.startsWith('SELECT'))return {rows:[{id:7,email:'synthetic@example.test',count:1}],rowCount:1};return {rows:[],rowCount:1};}
 async end(){this.ended=true;}
}
pg.Pool=MockPool;
const openPostgres=require('./storage/postgres'),PostgresStore=require('./postgres-session-store');
const invoke=(store,fn,...args)=>new Promise((resolve,reject)=>store[fn](...args,(err,value)=>err?reject(err):resolve(value)));
(async()=>{
 await assert.rejects(()=>openPostgres('postgresql://synthetic:synthetic@localhost/example?sslmode=disable'),/TLS/);
 const db=await openPostgres('postgresql://synthetic:synthetic@localhost/example?sslmode=require&sslrootcert=ignored');const pool=pools[0];assert.equal(pool.options.ssl.rejectUnauthorized,true);assert.equal(pool.options.max,5);assert(!pool.options.connectionString.includes('sslmode'));assert(!pool.options.connectionString.includes('sslrootcert'));console.log('PASS pg.Pool, bounded pooling, required verified TLS and connection-string SSL sanitization');
 const schema=calls.find(c=>c.sql.includes('CREATE TABLE IF NOT EXISTS users')).sql;await parse(schema);assert(schema.includes('pg_advisory')===false);assert(calls.some(c=>c.sql.includes('pg_advisory_xact_lock')));assert(schema.includes('BEFORE TRUNCATE ON orders'));assert(schema.includes("to_jsonb(NEW)-'status'-'payment_status'"));assert(schema.includes('ibw_audit_order'));assert(schema.includes('schema_migrations'));console.log('PASS PostgreSQL schema parses; transactional startup migrations, immutable snapshots, no-delete/no-truncate and audit definitions');
 assert.equal((await db.prepare('INSERT INTO users(email,password_hash,verified) VALUES(?,?,?)').run('synthetic@example.test','not-a-real-hash',1)).lastInsertRowid,7);const insert=calls.at(-1);assert(insert.sql.endsWith('VALUES($1,$2,$3) RETURNING id'));assert.deepEqual(insert.args,['synthetic@example.test','not-a-real-hash',1]);await db.prepare('SELECT status,COUNT(*) count FROM orders WHERE marketer=? GROUP BY status').all('synthetic');console.log('PASS parameterized adapter queries and RETURNING ids');
 const store=new PostgresStore(pool);assert.equal((await invoke(store,'get','synthetic-sid')).userId,7);await invoke(store,'set','synthetic-sid',{userId:7,cookie:{expires:new Date(Date.now()+10000).toISOString()}});await invoke(store,'touch','synthetic-sid',{cookie:{expires:new Date(Date.now()+10000).toISOString()}});await store.revokeUser(7);await invoke(store,'destroy','synthetic-sid');assert(calls.some(c=>c.sql.includes('ON CONFLICT(sid) DO UPDATE')));assert(calls.some(c=>c.sql.includes("data->>'userId'")));store.close();console.log('PASS DB-backed session read, upsert, expiry touch, revocation and logout contracts');
 const backup=await db.exportData();assert.equal(backup.format,'ibw-orders-postgres-export');assert.deepEqual(Object.keys(backup.tables),['users','sessions','orders','order_history','codes','schema_migrations']);assert(calls.some(c=>c.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));console.log('PASS consistent JSON export includes every data table, sessions and audit history');
 assert.equal(await db.consumeCode(7,'verify','valid-code-hash'),true);assert.equal(await db.consumeCode(7,'reset','wrong'),false);assert(calls.some(c=>c.sql.includes('FOR UPDATE')));console.log('PASS atomic one-time code consumption with row locks');
 for(const call of calls)if(call.sql!=='RELEASE CLIENT')await parse(call.sql);await db.close();assert(pool.ended);console.log('PASS all generated PG statements parse, and pool closes');
 console.log('IMPORTANT: live PostgreSQL/TLS end-to-end test NOT run: apt repository returned HTTP 500 and no server binaries were installed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
