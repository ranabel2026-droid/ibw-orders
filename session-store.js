const session = require('express-session');
const Database = require('better-sqlite3');
module.exports = class SQLiteStore extends session.Store {
  constructor(file) { super(); this.db = new Database(file);require('fs').chmodSync(file,0o600);this.db.pragma('journal_mode = WAL'); this.db.exec('CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL)'); this.timer=setInterval(()=>this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()),3600000);this.timer.unref(); }
  get(sid,cb) {try {const r=this.db.prepare('SELECT data FROM sessions WHERE sid=? AND expires>?').get(sid,Date.now());cb(null,r?JSON.parse(r.data):null);}catch(e){cb(e);} }
  set(sid,data,cb=()=>{}) {try {this.db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?)').run(sid,JSON.stringify(data),data.cookie.expires?new Date(data.cookie.expires).getTime():Date.now()+604800000);cb(null);}catch(e){cb(e);} }
  destroy(sid,cb=()=>{}) {try {this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb(null);}catch(e){cb(e);} }
  close(){clearInterval(this.timer);this.db.close();}
  async revokeUser(userId){this.db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.userId')=?").run(userId);}
  touch(sid,data,cb=()=>{}) {try {this.db.prepare('UPDATE sessions SET expires=? WHERE sid=?').run(new Date(data.cookie.expires).getTime(),sid);cb(null);}catch(e){cb(e);} }
};
