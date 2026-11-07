const {Pool,types}=require('pg');
// This app's ids, timestamps and counts are safely within JS integer precision.
types.setTypeParser(20,value=>Number(value));
const SCHEMA=`
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY,customer_id INTEGER NOT NULL REFERENCES users(id),customer_email TEXT NOT NULL,full_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,cart_link TEXT NOT NULL,marketer TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'جديد' CHECK(status IN ('جديد','قيد التنفيذ','تم الشحن','تم التسليم','ملغي')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),payment_method TEXT NOT NULL DEFAULT 'unspecified',payment_status TEXT NOT NULL DEFAULT 'غير مدفوع' CHECK(payment_status IN ('غير مدفوع','مدفوع')));
CREATE TABLE IF NOT EXISTS order_history(id SERIAL PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),from_status TEXT,to_status TEXT NOT NULL,actor TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),field TEXT NOT NULL DEFAULT 'status');
CREATE TABLE IF NOT EXISTS codes(id SERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),purpose TEXT NOT NULL,hash TEXT NOT NULL,expires BIGINT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,data JSONB NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfer_ref TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS receipts(id SERIAL PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),mime TEXT NOT NULL,data BYTEA NOT NULL,size INTEGER NOT NULL,uploaded_by TEXT NOT NULL DEFAULT 'customer',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'غير مدفوع' CHECK(payment_status IN ('غير مدفوع','مدفوع'));
ALTER TABLE order_history ADD COLUMN IF NOT EXISTS field TEXT NOT NULL DEFAULT 'status';
CREATE INDEX IF NOT EXISTS idx_customer_orders ON orders(customer_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_history(order_id,id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS idx_codes_user ON codes(user_id,purpose);
CREATE OR REPLACE FUNCTION ibw_forbid_removal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Orders and audit records are permanent'; END; $$;
CREATE OR REPLACE FUNCTION ibw_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-'status'-'payment_status') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'payment_status') THEN RAISE EXCEPTION 'Order snapshots are immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION ibw_immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records are immutable'; END; $$;
CREATE OR REPLACE FUNCTION ibw_audit_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,NULL,NEW.status,'customer:'||NEW.customer_id,'status');
  INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,NULL,NEW.payment_status,'customer:'||NEW.customer_id,'payment_status');
 ELSE
  IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,OLD.status,NEW.status,'admin','status'); END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,OLD.payment_status,NEW.payment_status,'admin','payment_status'); END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS keep_orders ON orders;
CREATE TRIGGER keep_orders BEFORE DELETE ON orders FOR EACH ROW EXECUTE FUNCTION ibw_forbid_removal();
DROP TRIGGER IF EXISTS keep_orders_truncate ON orders;
CREATE TRIGGER keep_orders_truncate BEFORE TRUNCATE ON orders FOR EACH STATEMENT EXECUTE FUNCTION ibw_forbid_removal();
DROP TRIGGER IF EXISTS immutable_orders ON orders;
CREATE TRIGGER immutable_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION ibw_order_snapshot();
DROP TRIGGER IF EXISTS immutable_history ON order_history;
CREATE TRIGGER immutable_history BEFORE UPDATE ON order_history FOR EACH ROW EXECUTE FUNCTION ibw_immutable_history();
DROP TRIGGER IF EXISTS keep_history ON order_history;
CREATE TRIGGER keep_history BEFORE DELETE ON order_history FOR EACH ROW EXECUTE FUNCTION ibw_forbid_removal();
DROP TRIGGER IF EXISTS keep_history_truncate ON order_history;
CREATE TRIGGER keep_history_truncate BEFORE TRUNCATE ON order_history FOR EACH STATEMENT EXECUTE FUNCTION ibw_forbid_removal();
DROP TRIGGER IF EXISTS keep_receipts ON receipts;
CREATE TRIGGER keep_receipts BEFORE DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION ibw_forbid_removal();
DROP TRIGGER IF EXISTS audit_order ON orders;
CREATE TRIGGER audit_order AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION ibw_audit_order();
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT(version) DO NOTHING;
`;
module.exports=async function openPostgres(databaseUrl){
 const url=new URL(databaseUrl);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('DATABASE_URL must be a PostgreSQL URL.');
 if(url.searchParams.get('sslmode')==='disable')throw Error('PostgreSQL requires verified TLS; sslmode=disable is not allowed.');
 // pg connection-string SSL parameters can override ssl options: strip them and always enforce verification.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl'])url.searchParams.delete(key);
 const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:Math.max(1,Math.min(20,Number(process.env.PG_POOL_MAX)||5)),idleTimeoutMillis:30000,connectionTimeoutMillis:15000,statement_timeout:30000});
 pool.on('error',()=>console.error('Postgres idle connection failed; requests will reconnect.'));
 const client=await pool.connect();let migrationError;
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(726431091)');await client.query(SCHEMA);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');migrationError=e;}finally{client.release();}
 if(migrationError){await pool.end();throw migrationError;}
 const params=sql=>{let n=0;return sql.replace(/\?/g,()=>'$'+(++n));};
 return {
  kind:'postgres',pool,
  prepare(sql){const converted=params(sql);return {
   get:async(...args)=>(await pool.query(converted,args)).rows[0],
   all:async(...args)=>(await pool.query(converted,args)).rows,
   run:async(...args)=>{const insert=/^\s*INSERT INTO (users|orders)\b/i.test(sql);const r=await pool.query(converted+(insert?' RETURNING id':''),args);return {changes:r.rowCount,lastInsertRowid:insert?r.rows[0]?.id:undefined};}
  };},
  async exportData(){const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const tables={};for(const t of ['users','sessions','orders','order_history','codes','schema_migrations'])tables[t]=(await c.query('SELECT * FROM '+t+' ORDER BY '+(t==='sessions'?'sid':t==='schema_migrations'?'version':'id'))).rows;await c.query('COMMIT');return {format:'ibw-orders-postgres-export',version:1,exported_at:new Date().toISOString(),tables};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},
  async consumeCode(userId,purpose,hash){const c=await pool.connect();try{await c.query('BEGIN');const row=(await c.query('SELECT * FROM codes WHERE user_id=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE',[userId,purpose])).rows[0];let ok=false;if(row&&row.expires>=Date.now()&&row.attempts<5){await c.query('UPDATE codes SET attempts=attempts+1 WHERE id=$1',[row.id]);if(row.hash===hash){await c.query('DELETE FROM codes WHERE id=$1',[row.id]);ok=true;}}await c.query('COMMIT');return ok;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},
  close:()=>pool.end()
 };
};
