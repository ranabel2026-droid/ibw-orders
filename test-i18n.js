// Fails if any Arabic UI/server string has no English translation (AR vs EN key sets).
const fs=require('fs');
const en=JSON.parse(fs.readFileSync(__dirname+'/i18n/en.json','utf8'));
const files=[__dirname+'/public/app.js',__dirname+'/server.js',...process.argv.slice(2)];
const AR=/[\u0600-\u06FF]/,keys=new Set();
for(const f of files)for(const part of fs.readFileSync(f,'utf8').split(/[<>`'"{}]|\$\{|\\n/)){const p=part.trim();if(AR.test(p))keys.add(p);}
const missing=[...keys].filter(k=>!(k in en)&&!/^IBW Orders · الإصدار/.test(k));
const empty=Object.entries(en).filter(([k,v])=>!v||AR.test(v)).map(([k])=>k);
console.log(`AR strings: ${keys.size}, EN entries: ${Object.keys(en).length}`);
if(missing.length||empty.length){console.error('Missing EN:',missing,'\nEmpty/Arabic EN:',empty);process.exit(1);}
console.log('PASS every Arabic string has an English translation');
