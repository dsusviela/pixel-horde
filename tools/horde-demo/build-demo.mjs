// inlines the sheets JSON and the two ground PNGs into the demo template
import fs from 'node:fs';
const [tpl,sheets,basalt,grass,out]=process.argv.slice(2);
const uri=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
let s=fs.readFileSync(tpl,'utf8');
s=s.replace('__SHEETS__',()=>fs.readFileSync(sheets,'utf8')).replace('__BASALT__',()=>uri(basalt)).replace('__GRASS__',()=>uri(grass));
fs.writeFileSync(out,s);console.log('wrote',out,(s.length/1024).toFixed(0)+' KB');
