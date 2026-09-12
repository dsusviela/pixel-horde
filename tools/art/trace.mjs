// Trace a reference PNG (concept sheet crop, upscaled pixel art, AI output) into
// makeSprite rows against a palette: detect the true texel scale (Astropulse
// pixeldetector: colour-delta peaks per column/row -> median spacing), take
// the dominant colour per cell, snap every cell to the nearest palette entry
// in OKLab, print the rows + literal, write a sketch JSON and lint it.
//
//   node tools/art/trace.mjs in.png --pal MAT.ember|lospec:apollo|'#a,#b'|pal.json
//        [--crop x,y,w,h] [--scale N|auto] [--bg auto|#hex|none] [--alpha 128]
//        [--den 2] [--name slagBody] [--out sketch.json] [--max 64]
// --bg auto keys out the most common corner colour (for opaque references); --max
// refuses outputs wider/taller than N texels so a wrong scale is caught early.
// The result is a starting point: eyes, outline and feet still get drawn by hand.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPng} from '../pixcanvas.mjs';
import {parseArgs} from '../pixboot.mjs';
import {hex,rgb,resolvePal,nearestHex,lintRows,formatIssues,literal} from './pix.mjs';

const BOOL=new Set(['help']);

export function detectScale(c){
  const {width:w,height:h}=c;
  const px=(x,y)=>{const p=c.get(x,y);return p&&p[3]>0.5?[p[0],p[1],p[2]]:[0,0,0];};
  const peaks=arr=>{const mean=arr.reduce((a,b)=>a+b,0)/arr.length,ps=[];
    for(let i=1;i+1<arr.length;i++)if(arr[i]>mean&&arr[i]>=arr[i-1]&&arr[i]>arr[i+1])ps.push(i);
    const d=ps.slice(1).map((p,i)=>p-ps[i]).filter(x=>x>0).sort((a,b)=>a-b);return d.length?d[d.length>>1]:1;};
  const dx=new Array(w).fill(0),dy=new Array(h).fill(0);
  for(let y=0;y<h;y++)for(let x=1;x<w;x++){const a=px(x,y),b=px(x-1,y);dx[x]+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);}
  for(let x=0;x<w;x++)for(let y=1;y<h;y++){const a=px(x,y),b=px(x,y-1);dy[y]+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);}
  const sx=peaks(dx),sy=peaks(dy);
  return Math.max(1,Math.round((sx+sy)/2));
}
// dominant opaque colour per cell -> rows against pal
export function traceCanvas(c,pal,o={}){
  const S=o.scale||1,alpha=(o.alpha||128)/255,bg=o.bg,W=Math.floor(c.width/S),H=Math.floor(c.height/S);
  const list=Object.values(pal),byHex={};for(const [k,v] of Object.entries(pal))byHex[v.toLowerCase()]=k;
  const cache={},snap=h=>cache[h]||(cache[h]=byHex[nearestHex(list,h).toLowerCase()]);
  const rows=[];
  for(let cy=0;cy<H;cy++){
    let s='';
    for(let cx=0;cx<W;cx++){
      const count={};let best=null,bn=0;
      for(let j=0;j<S;j++)for(let i=0;i<S;i++){const p=c.get(cx*S+i,cy*S+j);if(!p||p[3]<alpha)continue;
        const h=hex(p[0],p[1],p[2]);if(bg&&h===bg)continue;count[h]=(count[h]||0)+1;if(count[h]>bn){bn=count[h];best=h;}}
      s+=best&&bn>=S*S*0.3?snap(best):'.';
    }
    rows.push(s);
  }
  return rows;
}
// trim fully transparent border rows/cols, keeping even dims when den 2
export function trimRows(rows,den){
  let y0=0,y1=rows.length-1;while(y0<=y1&&!/[^.]/.test(rows[y0]))y0++;while(y1>=y0&&!/[^.]/.test(rows[y1]))y1--;
  if(y0>y1)return ['.'];
  let x0=Infinity,x1=-1;for(let y=y0;y<=y1;y++){const a=rows[y].search(/[^.]/),b=rows[y].replace(/\.+$/,'').length-1;if(a>=0&&a<x0)x0=a;if(b>x1)x1=b;}
  let out=rows.slice(y0,y1+1).map(r=>r.slice(x0,x1+1));
  if(den===2){if(out[0].length%2)out=out.map(r=>r+'.');if(out.length%2)out.push('.'.repeat(out[0].length));}
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help||!o._[0]){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(2);}
  let c=readPng(fs.readFileSync(o._[0]));
  if(o.crop){const [x,y,w,h]=o.crop.split(',').map(Number);const {PixCanvas}=await import('../pixcanvas.mjs');const cc=new PixCanvas(w,h);cc.getContext('2d').drawImage(c,x,y,w,h,0,0,w,h);c=cc;}
  const pal=await resolvePal(o.pal,o.file);
  const scale=o.scale&&o.scale!=='auto'?+o.scale:detectScale(c);
  let bg=null;
  if(o.bg&&o.bg!=='none'){
    if(o.bg==='auto'){const cnt={};for(const [x,y] of [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]]){const p=c.get(x,y);if(p&&p[3]>0.5){const h=hex(p[0],p[1],p[2]);cnt[h]=(cnt[h]||0)+1;}}bg=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(e=>e[0])[0]||null;}
    else bg=hex(...rgb(o.bg));
  }
  const den=+(o.den||2),max=+(o.max||64);
  let rows=trimRows(traceCanvas(c,pal,{scale,alpha:+(o.alpha||128),bg}),den);
  console.log('source '+c.width+'x'+c.height+'  scale '+scale+(o.scale&&o.scale!=='auto'?'':' (auto)')+'  bg '+(bg||'alpha')+'  -> '+rows[0].length+'x'+rows.length+' texels');
  if(rows[0].length>max||rows.length>max){console.error('result exceeds --max '+max+'; pass --scale N or --crop');process.exit(2);}
  const used={};for(const [k,v] of Object.entries(pal))if(rows.some(r=>r.includes(k)))used[k]=v;
  console.log(rows.join('\n'));
  console.log('pal '+Object.entries(used).map(([k,v])=>k+'='+v).join(' '));
  console.log(literal(o.name||'traced',rows,used,den));
  console.log(formatIssues('',lintRows(rows,used,{den})));
  const out=o.out||(o.name||'traced')+'.json';
  fs.writeFileSync(out,JSON.stringify({rows,pal:used,den},null,0));
  console.log('wrote',path.resolve(out));
}
