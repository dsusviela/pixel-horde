// Palette ramps and Lospec palettes as MAT-style objects, with a swatch PNG.
//   node tools/art/ramp.mjs --hue 25 [--steps 5] [--l 0.22,0.85] [--chroma 0.13] [--shift 22] [--name ember]
//       hue-shifted ramp in OKLCH (rules 19-21): shadows cooler and duller, lights warmer,
//       chroma peaks mid-ramp; prints hex dark->light and a MAT object {K,D,M,L,H}
//   node tools/art/ramp.mjs from '#ff5a3d' [--steps 5 ..]     ramp built around a base colour (its hue + chroma)
//   node tools/art/ramp.mjs lospec apollo                     fetch a Lospec palette (slug from its URL)
//   node tools/art/ramp.mjs mat [--file F]                    every MAT ramp of the workspace as swatches
//   --snap lospec:slug|MAT.name|#a,#b   snap each generated colour to the nearest palette entry (OKLab)
//   --out swatch.png                    swatch strip (default ramp.png / lospec-<slug>.png / mat.png)
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PixCanvas} from '../pixcanvas.mjs';
import {parseArgs,writePng} from '../pixboot.mjs';
import {text} from '../sheet.mjs';
import {ramp,rampToMat,lospec,loadMAT,resolvePal,nearestHex,hexToOklch} from './pix.mjs';

const BOOL=new Set(['help']);

// rows of [label, [hex..]] -> swatch strip
export function swatchPng(rows){
  const S=26,LAB=90,W=LAB+Math.max(...rows.map(([,l])=>l.length))*S+8,H=rows.length*(S+16)+8;
  const c=new PixCanvas(W,H),g=c.getContext('2d');g.fillStyle='#0b0b10';g.fillRect(0,0,W,H);
  rows.forEach(([lb,list],i)=>{
    const y=8+i*(S+16);text(c,4,y+8,String(lb).slice(0,14),'#ffffff',1);
    list.forEach((h,j)=>{g.fillStyle=h;g.fillRect(LAB+j*S,y,S-2,S);text(c,LAB+j*S,y+S+3,h.slice(1),'#9aa2ad',1);});
  });
  return c;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL),cmd=o._[0];
  if(o.help||(!cmd&&o.hue===undefined)){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(2);}
  if(cmd==='lospec'){
    const p=await lospec(o._[1]);
    console.log(p.name+' by '+p.author+' ('+p.colors.length+')\n'+p.colors.join(' '));
    console.log(JSON.stringify(await resolvePal('lospec:'+o._[1])));
    writePng(swatchPng([[o._[1],p.colors]]),o.out||'lospec-'+o._[1]+'.png');
  }else if(cmd==='mat'){
    const MAT=loadMAT(o.file);
    const rows=Object.entries(MAT).map(([k,v])=>[k,['K','D','M','L','H','W'].filter(x=>v[x]).map(x=>v[x])]);
    for(const [k,l] of rows)console.log(k.padEnd(8),l.join(' '),' L:',l.map(h=>hexToOklch(h)[0].toFixed(2)).join(' '));
    writePng(swatchPng(rows),o.out||'mat.png');
  }else{
    const opts={steps:+(o.steps||5),shift:o.shift===undefined?22:+o.shift};
    if(o.l)opts.l=o.l.split(',').map(Number);
    if(o.chroma!==undefined)opts.chroma=+o.chroma;
    if(cmd==='from'){const [L,C,H]=hexToOklch(o._[1]);opts.hue=H;if(o.chroma===undefined)opts.chroma=Math.max(0.04,C);if(!o.l)opts.l=[Math.max(0.15,L-0.3),Math.min(0.92,L+0.3)];}
    else opts.hue=+o.hue;
    let list=ramp(opts);
    if(o.snap){const pal=Object.values(await resolvePal(o.snap,o.file));list=list.map(h=>nearestHex(pal,h));}
    const name=o.name||('h'+Math.round(opts.hue));
    console.log(list.join(' '));
    console.log('L:',list.map(h=>hexToOklch(h)[0].toFixed(2)).join(' '),' C:',list.map(h=>hexToOklch(h)[1].toFixed(3)).join(' '),' H:',list.map(h=>Math.round(hexToOklch(h)[2])).join(' '));
    console.log(name+':'+JSON.stringify(rampToMat(list)).replace(/"/g,"'")+',');
    writePng(swatchPng([[name,list]]),o.out||'ramp.png');
  }
}
