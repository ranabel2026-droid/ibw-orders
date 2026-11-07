const Database=require('better-sqlite3'),fs=require('fs'),path=require('path');
module.exports=function openSQLite(dataDir){
const db = new Database(path.join(dataDir, 'orders.sqlite'));
fs.chmodSync(path.join(dataDir, 'orders.sqlite'), 0o600);
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('synchronous = FULL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id), customer_email TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, cart_link TEXT NOT NULL, marketer TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'جديد' CHECK(status IN ('جديد','قيد التنفيذ','تم الشحن','تم التسليم','ملغي')), created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS order_history(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), from_status TEXT, to_status TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS codes(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), purpose TEXT NOT NULL, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_customer_orders ON orders(customer_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_history(order_id,id);
`);
// Non-destructive schema migrations: legacy orders retain an explicit 'unspecified' value.
if (!db.prepare('PRAGMA table_info(orders)').all().some(c=>c.name==='payment_method')) db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'unspecified'");
if (!db.prepare('PRAGMA table_info(orders)').all().some(c=>c.name==='transfer_ref')) db.exec("ALTER TABLE orders ADD COLUMN transfer_ref TEXT NOT NULL DEFAULT ''");
db.exec("CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), mime TEXT NOT NULL, data BLOB NOT NULL, size INTEGER NOT NULL, uploaded_by TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE TRIGGER IF NOT EXISTS keep_receipts BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'Receipts are permanent'); END;");
if (!db.prepare('PRAGMA table_info(orders)').all().some(c=>c.name==='payment_status')) db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'غير مدفوع' CHECK(payment_status IN ('غير مدفوع','مدفوع'))");
if (!db.prepare('PRAGMA table_info(order_history)').all().some(c=>c.name==='field')) db.exec("ALTER TABLE order_history ADD COLUMN field TEXT NOT NULL DEFAULT 'status'");
db.exec(`
DROP TRIGGER IF EXISTS immutable_orders;
DROP TRIGGER IF EXISTS audit_new_order;
CREATE TRIGGER IF NOT EXISTS keep_orders BEFORE DELETE ON orders BEGIN SELECT RAISE(ABORT,'Orders are permanent'); END;
CREATE TRIGGER IF NOT EXISTS immutable_orders BEFORE UPDATE ON orders WHEN NEW.id IS NOT OLD.id OR NEW.customer_id IS NOT OLD.customer_id OR NEW.customer_email IS NOT OLD.customer_email OR NEW.full_name IS NOT OLD.full_name OR NEW.phone IS NOT OLD.phone OR NEW.address IS NOT OLD.address OR NEW.cart_link IS NOT OLD.cart_link OR NEW.marketer IS NOT OLD.marketer OR NEW.notes IS NOT OLD.notes OR NEW.created_at IS NOT OLD.created_at OR NEW.payment_method IS NOT OLD.payment_method BEGIN SELECT RAISE(ABORT,'Order snapshots are immutable'); END;
CREATE TRIGGER IF NOT EXISTS keep_history BEFORE DELETE ON order_history BEGIN SELECT RAISE(ABORT,'Audit records are permanent'); END;
CREATE TRIGGER IF NOT EXISTS immutable_history BEFORE UPDATE ON order_history BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TRIGGER IF NOT EXISTS audit_new_order AFTER INSERT ON orders BEGIN INSERT INTO order_history(order_id,from_status,to_status,actor) VALUES(NEW.id,NULL,NEW.status,'customer:'||NEW.customer_id); INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,NULL,NEW.payment_status,'customer:'||NEW.customer_id,'payment_status'); END;
CREATE TRIGGER IF NOT EXISTS audit_status AFTER UPDATE OF status ON orders WHEN NEW.status IS NOT OLD.status BEGIN INSERT INTO order_history(order_id,from_status,to_status,actor) VALUES(NEW.id,OLD.status,NEW.status,'admin'); END;

CREATE TRIGGER IF NOT EXISTS audit_payment AFTER UPDATE OF payment_status ON orders WHEN NEW.payment_status IS NOT OLD.payment_status BEGIN INSERT INTO order_history(order_id,from_status,to_status,actor,field) VALUES(NEW.id,OLD.payment_status,NEW.payment_status,'admin','payment_status'); END;
`);

return {
 kind:'sqlite', raw:db,
 prepare(sql){const stmt=db.prepare(sql);return {get:async(...args)=>stmt.get(...args),all:async(...args)=>stmt.all(...args),run:async(...args)=>stmt.run(...args)};},
 backup:file=>db.backup(file),
 close:async()=>db.close(),
 async consumeCode(userId,purpose,hash){return db.transaction(()=>{const row=db.prepare('SELECT * FROM codes WHERE user_id=? AND purpose=? ORDER BY id DESC LIMIT 1').get(userId,purpose);if(!row||row.expires<Date.now()||row.attempts>=5)return false;db.prepare('UPDATE codes SET attempts=attempts+1 WHERE id=?').run(row.id);if(hash!==row.hash)return false;db.prepare('DELETE FROM codes WHERE id=?').run(row.id);return true;})();}
};
};
