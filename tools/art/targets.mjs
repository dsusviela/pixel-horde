// Boots the workspace (plus --inject art modules) and resolves sprite names,
// families or a sketch JSON to lint/preview targets:
//   {name, items:[{label,spr,rows,pal,den}], groups:[[item,...],...]}
// items are every canvas the const flattens to (arrays, .frames sheets, prop
// tables); groups are frame sets in play order (an array const, or each facing
// of an atlasSheet). rows/pal come from the module spec when the const was
// injected, else are reconstructed from the texels (letters per unique colour).
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {bootPix,resolveFile,extractScript,applyInject} from '../pixboot.mjs';
import {FAMILIES} from '../sheet.mjs';
import {rowsFromCanvas,canvasFromRows} from './pix.mjs';

const isCanvas=v=>v&&typeof v==='object'&&typeof v.getContext==='function';

// merged {name:spec} of the injected modules (for rows/pal + the list of names they define)
export async function loadSpecs(modulePaths){
  const specs={};
  for(const mp of modulePaths||[]){
    const abs=path.isAbsolute(mp)?mp:path.resolve(mp);
    const mod=await import(pathToFileURL(abs).href+'?t='+Date.now());
    for(const [k,v] of Object.entries(mod.default||mod))if(!k.startsWith('__'))specs[k]=v;
  }
  return specs;
}
export async function bootArt(o){
  const file=resolveFile(o.file);let src=extractScript(file),literals=[];
  const mods=o.inject?String(o.inject).split(','):[];
  if(mods.length){const r=await applyInject(src,mods);src=r.src;literals=r.literals;}
  const g=bootPix({file,src,seed:+(o.seed||1)});
  const DEN=g.has('DEN')?+g.ev('DEN'):1;
  const specs=await loadSpecs(mods);
  return {g,DEN,specs,literals,file};
}
// names from --family / positionals / the injected modules
export function pickNames(o,specs){
  const names=[];
  for(const p of o._||[])for(const n of p.split(','))if(n)names.push(n);
  if(o.family){const fams=o.family==='all'?Object.keys(FAMILIES):o.family.split(',');
    for(const f of fams){if(!FAMILIES[f])throw new Error('unknown family '+f+'; have '+Object.keys(FAMILIES).join('|'));names.push(...Object.keys(FAMILIES[f]));}}
  if(!names.length)names.push(...Object.keys(specs));
  return [...new Set(names)];
}
function item(label,spr,spec){
  let rows,pal,den=spr.den||1;
  if(spec&&spec.rows&&spec.pal&&typeof spec.pal==='object'){rows=spec.rows;pal=spec.pal;den=spec.den||den;}
  else{const r=rowsFromCanvas(spr,spec&&typeof spec.pal==='object'?spec.pal:null);rows=r.rows;pal=r.pal;}
  return {label,spr,rows,pal,den};
}
export function resolveTarget(g,name,spec){
  if(!g.has(name))return null;
  const v=g.ev(name),items=[],groups=[];
  const walk=(label,x,top)=>{
    if(isCanvas(x)){
      const it=item(label,x,spec);items.push(it);
      if(x.frames){const dirs=['down','up','left','right'];x.frames.forEach((fr,d)=>{const grp=fr.map((f,i)=>item(label+'.'+(dirs[d]||d)+'['+i+']',f,null));items.push(...grp);groups.push(grp);});}
    }
    else if(Array.isArray(x)){const before=items.length;x.forEach((e,i)=>walk(label+'['+i+']',e,false));
      const grp=items.slice(before);if(top&&grp.length>1&&grp.every(e=>!e.label.includes('.')))groups.push(grp);}
    else if(x&&typeof x==='object'){if(isCanvas(x.spr))walk(label,x.spr,false);else for(const k of Object.keys(x))walk(label+'.'+k,x[k],false);}
  };
  walk(name,v,true);
  return {name,items,groups};
}
// a sketch JSON: {rows,pal,den} or {name:{rows,pal,den},...} or [{rows,pal,den},...] (frames)
export function sketchTargets(file){
  const j=JSON.parse(fs.readFileSync(file,'utf8')),base=path.basename(file,'.json'),out=[];
  const mk=(name,s)=>({label:name,spr:canvasFromRows(s.rows,s.pal,s.den||2),rows:s.rows,pal:s.pal,den:s.den||2});
  if(Array.isArray(j)){const items=j.map((s,i)=>mk(base+'['+i+']',s));out.push({name:base,items,groups:[items]});}
  else if(j.rows)out.push({name:base,items:[mk(base,j)],groups:[]});
  else for(const [k,s] of Object.entries(j)){if(Array.isArray(s)){const items=s.map((f,i)=>mk(k+'['+i+']',f));out.push({name:k,items,groups:[items]});}else out.push({name:k,items:[mk(k,s)],groups:[]});}
  return out;
}
