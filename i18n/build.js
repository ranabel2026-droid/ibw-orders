// Builds public/i18n.js from i18n/en.json + runtime.js. Usage: node i18n/build.js [outDir...]
const fs=require('fs'),path=require('path');
const en=fs.readFileSync(path.join(__dirname,'en.json'),'utf8');
const out=fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8').replace('__EN__',JSON.stringify(JSON.parse(en)));
for(const d of (process.argv.slice(2).length?process.argv.slice(2):[path.join(__dirname,'..','public')]))fs.writeFileSync(path.join(d,'i18n.js'),out);
