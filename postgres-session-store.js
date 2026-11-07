const session=require('express-session');
module.exports=class PostgresStore extends session.Store {
 constructor(pool){super();this.pool=pool;this.timer=setInterval(()=>pool.query('DELETE FROM sessions WHERE expires<$1',[Date.now()]).catch(()=>console.error('Session expiry cleanup failed.')),3600000);this.timer.unref();}
 get(sid,cb){this.pool.query('SELECT data FROM sessions WHERE sid=$1 AND expires>$2',[sid,Date.now()]).then(r=>cb(null,r.rows[0]?.data||null),cb);}
 set(sid,data,cb=()=>{}){const expires=data.cookie.expires?new Date(data.cookie.expires).getTime():Date.now()+604800000;this.pool.query('INSERT INTO sessions(sid,data,expires) VALUES($1,$2::jsonb,$3) ON CONFLICT(sid) DO UPDATE SET data=EXCLUDED.data,expires=EXCLUDED.expires',[sid,JSON.stringify(data),expires]).then(()=>cb(null),cb);}
 destroy(sid,cb=()=>{}){this.pool.query('DELETE FROM sessions WHERE sid=$1',[sid]).then(()=>cb(null),cb);}
 touch(sid,data,cb=()=>{}){this.pool.query('UPDATE sessions SET expires=$1 WHERE sid=$2',[new Date(data.cookie.expires).getTime(),sid]).then(()=>cb(null),cb);}
 async revokeUser(userId){await this.pool.query("DELETE FROM sessions WHERE data->>'userId'=$1",[String(userId)]);}
 close(){clearInterval(this.timer);}
};
