// Lands one or more §1.3 art modules into a workspace html for good (the
// same string edits tools/frame.mjs --inject applies at boot, written back).
//   node tools/art/land.mjs tools/art/ninja.mjs [--file playground.html]
// Refuses to land a module twice (its first __patches anchor must still exist).
import fs from 'node:fs';
import {applyInject,resolveFile,extractScript,parseArgs,CRLF} from '../pixboot.mjs';
const o=parseArgs(process.argv.slice(2),new Set());
const file=resolveFile(o.file);
const html=fs.readFileSync(file,'utf8');
const script=extractScript(file);
const {src,literals}=await applyInject(script,o._);
if(src===script)throw new Error('nothing changed');
const out=html.replace(script,()=>src);
fs.writeFileSync(file,out);
console.log('landed',o._.join(','),'into',file,'-',literals.length,'const(s)',(out.length/1024|0)+' KB');
