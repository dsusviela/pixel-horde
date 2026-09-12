// Zero-dependency helpers shared by the art tools (preview, lint, ramp, trace):
// colour maths in OKLab/OKLCH (Ottosson, public domain), hue-shifted ramps,
// Lospec fetch, Aseprite's pixel-perfect line (doc lib, MIT), rows <-> canvas,
// and the sprite / frame lints behind tools/art/lint.mjs.
// Rows are the makeSprite idiom: one string per row, one letter per texel,
// '.' transparent, pal maps letter -> '#rrggbb'.
import fs from 'node:fs';
import {PixCanvas} from '../pixcanvas.mjs';
import {resolveFile,extractScript} from '../pixboot.mjs';

// ---- colour ----
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
export function rgb(h){h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
const lin=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const gam=c=>{c=clamp(c,0,1);return 255*(c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055);};
export function rgbToOklab([r,g,b]){
  r=lin(r);g=lin(g);b=lin(b);
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  return [0.2104542553*l+0.7936177850*m-0.0040720468*s,1.9779984951*l-2.4285922050*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.8086757660*s];
}
// returns [r,g,b] in 0..255 and inGamut:false when clipping happened
export function oklabToRgb([L,a,b]){
  const l_=L+0.3963377774*a+0.2158037573*b,m_=L-0.1055613458*a-0.0638541728*b,s_=L-0.0894841775*a-1.2914855480*b;
  const l=l_*l_*l_,m=m_*m_*m_,s=s_*s_*s_;
  const r=4.0767416621*l-3.3077115913*m+0.2309699292*s,g=-1.2684380046*l+2.6097574011*m-0.3413193965*s,bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s;
  const inGamut=r>=-0.002&&r<=1.002&&g>=-0.002&&g<=1.002&&bb>=-0.002&&bb<=1.002;
  return {rgb:[gam(r),gam(g),gam(bb)],inGamut};
}
export const hexToOklab=h=>rgbToOklab(rgb(h));
export function hexToOklch(h){const [L,a,b]=hexToOklab(h);return [L,Math.hypot(a,b),((Math.atan2(b,a)*180/Math.PI)+360)%360];}
// OKLCH -> hex, reducing chroma until the colour fits sRGB (keeps L and hue)
export function oklchToHex(L,C,H){
  const rad=H*Math.PI/180;
  for(let i=0;i<24;i++){
    const r=oklabToRgb([L,C*Math.cos(rad),C*Math.sin(rad)]);
    if(r.inGamut||C<0.001)return hex(...r.rgb);
    C*=0.85;
  }
  return hex(...oklabToRgb([L,0,0]).rgb);
}
export const dist=(h1,h2)=>{const a=hexToOklab(h1),b=hexToOklab(h2);return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);};
export function nearestHex(list,h){let best=null,bd=Infinity;for(const c of list){const d=dist(c,h);if(d<bd){bd=d;best=c;}}return best;}
export const lum=h=>hexToOklab(h)[0];

// Hue-shifted ramp (Slynyrd #1, Pedro #6): shadows drift toward cool (~265deg)
// and lose chroma, lights drift toward warm (~85deg); chroma peaks mid-ramp.
//   ramp({hue:25, steps:5, l:[0.22,0.85], chroma:0.13, shift:22}) -> ['#..',...] dark->light
export function ramp(o={}){
  const steps=o.steps||5,[l0,l1]=o.l||[0.22,0.85],C=o.chroma===undefined?0.13:o.chroma,shift=o.shift===undefined?22:o.shift,hue=((o.hue||0)%360+360)%360;
  const toward=(from,to)=>{let d=((to-from)%360+360)%360;if(d>180)d-=360;return Math.sign(d)||1;};
  const cool=toward(hue,265),warm=toward(hue,85);
  const out=[];
  for(let i=0;i<steps;i++){
    const t=steps===1?0.5:i/(steps-1);
    const L=l0+(l1-l0)*t;
    const c=C*(1-Math.pow(2*t-1,2)*0.55);                 // peaks mid, never 0
    const h=hue+(t<0.5?(0.5-t)*2*shift*cool:(t-0.5)*2*shift*warm);
    out.push(oklchToHex(L,c,h));
  }
  return out;
}
// MAT-style object from a dark->light list: K D M L H (5), K D M L (4), D M L (3)
export function rampToMat(list){
  const keys={5:['K','D','M','L','H'],4:['K','D','M','L'],3:['D','M','L'],6:['K','D','M','L','H','W'],2:['D','L']}[list.length]||list.map((_,i)=>String(i));
  const o={};list.forEach((c,i)=>o[keys[i]]=c);return o;
}
// Lospec palette by slug -> {name,author,colors:[#hex]} (https://lospec.com/palettes/api)
export async function lospec(slug){
  const r=await fetch('https://lospec.com/palette-list/'+slug+'.json');
  if(!r.ok)throw new Error('lospec '+slug+': HTTP '+r.status);
  const j=await r.json();
  if(j.error)throw new Error('lospec '+slug+': '+j.error);
  return {name:j.name,author:j.author,colors:j.colors.map(c=>'#'+c.toLowerCase())};
}
// the MAT table of a workspace html as a plain object (regex + Function, no boot)
export function loadMAT(file){
  const src=extractScript(resolveFile(file));
  const m=src.match(/const MAT=\{[\s\S]*?\n\};/);
  if(!m)throw new Error('no MAT block in '+file);
  return new Function(m[0].replace('const MAT=','return ')+' ')();
}
// resolve a --pal spec: MAT.ember | lospec:apollo | #a,#b,#c | file.json ({letter:hex}) -> {letter:hex}
const LETTERS='KDMLHWOYRGVCSPABEFIJNQTUXZabcdefghijklmnopqrstuvwxyz0123456789';
export async function resolvePal(spec,file){
  if(!spec)throw new Error('--pal required (MAT.name | lospec:slug | #hex,#hex | pal.json)');
  if(spec.startsWith('MAT.'))return {...loadMAT(file)[spec.slice(4)]};
  let list;
  if(spec.startsWith('lospec:'))list=(await lospec(spec.slice(7))).colors;
  else if(spec.endsWith('.json'))return JSON.parse(fs.readFileSync(spec,'utf8'));
  else list=spec.split(',').map(s=>s.trim());
  const byL=list.slice().sort((a,b)=>lum(a)-lum(b));  // dark -> light so K-ish letters land on darks
  const o={};byL.forEach((c,i)=>o[LETTERS[i]||('c'+i)]=c);return o;
}

// ---- Aseprite algo_line_perfect (src/doc/algo.cpp, MIT): no L-shaped doubles ----
export function linePerfect(x0,y0,x1,y1){
  const pts=[];let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),swap=false;
  if(dy>dx){[x0,y0]=[y0,x0];[x1,y1]=[y1,x1];[dx,dy]=[dy,dx];swap=true;}
  const sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx>>1,y=y0;
  for(let x=x0;;x+=sx){
    pts.push(swap?[y,x]:[x,y]);
    if(x===x1)break;
    e-=dy;if(e<0){y+=sy;e+=dx;}
  }
  return pts;
}

// ---- rows <-> canvas ----
export function canvasFromRows(rows,pal,den){
  const w=rows[0].length,h=rows.length,c=new PixCanvas(w,h),g=c.getContext('2d');
  c.den=den||1;c.uw=w/c.den;c.uh=h/c.den;
  for(let y=0;y<h;y++)for(let x=0;x<rows[y].length;x++){const ch=rows[y][x];if(ch==='.'||ch===' ')continue;g.fillStyle=pal[ch]||'#f0f';g.fillRect(x,y,1,1);}
  return c;
}
// letters per unique opaque colour (pal letters reused when the colour matches one)
// unknown colours get letters in luminance order, so K is always the darkest
export function rowsFromCanvas(c,pal){
  const byHex={};if(pal)for(const [k,v] of Object.entries(pal))byHex[v.toLowerCase()]=k;
  const grid=[],fresh=new Set();
  for(let y=0;y<c.height;y++){const r=[];for(let x=0;x<c.width;x++){const p=c.get(x,y);if(!p||p[3]<0.5){r.push(null);continue;}const h=hex(p[0],p[1],p[2]);r.push(h);if(!byHex[h])fresh.add(h);}grid.push(r);}
  let n=0;
  for(const h of [...fresh].sort((a,b)=>lum(a)-lum(b))){while(n<LETTERS.length&&(pal&&pal[LETTERS[n]]))n++;byHex[h]=LETTERS[n++]||'?';}
  const out={},rows=grid.map(r=>r.map(h=>{if(!h)return '.';out[byHex[h]]=h;return byHex[h];}).join(''));
  return {rows,pal:out};
}
export const literal=(name,rows,pal,den)=>'const '+name+'=makeSprite('+JSON.stringify(rows)+','+JSON.stringify(pal)+(den?','+den:'')+');';

// ---- lints (rules in .claude/skills/pixel-art/rules.md) ----
const GROUND={basalt:'#2c2325',grass:'#27401f'};   // MAT mid tones the sheet draws on
export function budget(w,h){const s=Math.max(w,h);return s<=8?4:s<=16?8:s<=32?16:32;}
// issues: {level:'error'|'warn'|'info', code, msg}
export function lintRows(rows,pal,o={}){
  const iss=[],add=(level,code,msg)=>iss.push({level,code,msg});
  const w=rows[0].length,h=rows.length,den=o.den||1;
  if(rows.some(r=>r.length!==w))add('error','ragged','row widths differ: '+rows.map(r=>r.length).join(','));
  if(den===2&&(w%2||h%2))add('error','odd-dims',w+'x'+h+' at den 2 (needs even dims, checklist 2)');
  const used=new Set();for(const r of rows)for(const ch of r)if(ch!=='.'&&ch!==' ')used.add(ch);
  const unknown=[...used].filter(k=>!pal[k]);
  if(unknown.length)add('error','unknown-letter','letters not in pal (draw as magenta): '+unknown.join(''));
  const cols=[...used].filter(k=>pal[k]).map(k=>pal[k].toLowerCase());
  const uniq=[...new Set(cols)];
  const bud=budget(w,h);
  if(uniq.length>bud)add('warn','budget',uniq.length+' colours, budget for '+w+'x'+h+' is '+bud+' (rule 17)');
  for(const k of used)if(pal[k]&&/^#(000000|fff(fff)?|000)$/i.test(pal[k]))add('warn','pure-bw',k+'='+pal[k]+' pure black/white (rule 22)');
  for(const k of used)if(pal[k]&&/^#f0f$|^#ff00ff$/i.test(pal[k]))add('error','magenta',k+' is the missing-letter magenta');
  const at=(x,y)=>x<0||y<0||y>=h||x>=rows[y].length?'.':rows[y][x]===' '?'.':rows[y][x];
  // orphans (rule 11): opaque texel with no 4-neighbour of its own letter
  const orph=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=at(x,y);if(c==='.')continue;
    if(at(x-1,y)!==c&&at(x+1,y)!==c&&at(x,y-1)!==c&&at(x,y+1)!==c)orph.push(c+'@'+x+','+y);}
  if(orph.length)add(orph.length>4?'warn':'info','orphans',orph.length+' orphan texel(s) (rule 11; eyes/highlights may be deliberate): '+orph.slice(0,10).join(' ')+(orph.length>10?' ...':''));
  // hugging runs (rule 12): equal-extent runs (>=3) of two colours stacked
  const runs=r=>{const out=[];let x=0;while(x<w){const c=at(x,r);let e=x;while(e+1<w&&at(e+1,r)===c)e++;if(c!=='.'&&e-x+1>=3)out.push([x,e,c]);x=e+1;}return out;};
  const vruns=cx=>{const out=[];let y=0;while(y<h){const c=at(cx,y);let e=y;while(e+1<h&&at(cx,e+1)===c)e++;if(c!=='.'&&e-y+1>=3)out.push([y,e,c]);y=e+1;}return out;};
  const band=[];
  for(let y=0;y+1<h;y++){const a=runs(y),b=runs(y+1);for(const ra of a)for(const rb of b)if(ra[0]===rb[0]&&ra[1]===rb[1]&&ra[2]!==rb[2])band.push('rows '+y+'-'+(y+1)+' x'+ra[0]+'-'+ra[1]);}
  for(let x=0;x+1<w;x++){const a=vruns(x),b=vruns(x+1);for(const ra of a)for(const rb of b)if(ra[0]===rb[0]&&ra[1]===rb[1]&&ra[2]!==rb[2])band.push('cols '+x+'-'+(x+1)+' y'+ra[0]+'-'+ra[1]);}
  if(band.length)add(band.length>2?'warn':'info','banding',band.length+' hugging run pair(s) (rule 12): '+band.slice(0,6).join('; ')+(band.length>6?' ...':''));
  // outline coverage (rules 33/37/38): share of edge texels in the darkest colour
  if(uniq.length>1){
    const darkest=uniq.slice().sort((a,b)=>lum(a)-lum(b))[0];
    let edge=0,dark=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=at(x,y);if(c==='.')continue;
      if(at(x-1,y)==='.'||at(x+1,y)==='.'||at(x,y-1)==='.'||at(x,y+1)==='.'){edge++;if(pal[c]&&pal[c].toLowerCase()===darkest)dark++;}}
    const pct=edge?Math.round(100*dark/edge):0;
    add(pct<50&&Math.max(w,h)<=32?'warn':'info','outline',pct+'% of edge texels are the darkest colour '+darkest+(pct<50?' (small sprites want a K outline, rule 37)':''));
    // value contrast vs both grounds (rule 24): mean L of body vs ground mid tone
    let sum=0,n=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=at(x,y);if(c!=='.'&&pal[c]){sum+=lum(pal[c]);n++;}}
    const L=n?sum/n:0,dB=Math.abs(L-lum(GROUND.basalt)),dG=Math.abs(L-lum(GROUND.grass));
    if(dB<0.12&&dG<0.12)add('warn','contrast','mean body L '+L.toFixed(2)+' within 0.12 of both grounds (rule 24)');
    else add('info','contrast','mean body L '+L.toFixed(2)+' vs basalt '+lum(GROUND.basalt).toFixed(2)+' / grass '+lum(GROUND.grass).toFixed(2));
  }
  add('info','size',w+'x'+h+(den>1?' den '+den+' = '+(w/den)+'x'+(h/den)+' units':'')+', '+uniq.length+' colour(s)');
  return iss;
}
// frames: [{rows,pal,label}] in play order (rules 6/44/51, IoU + drift gates)
export function lintFrames(frames,o={}){
  const iss=[],add=(level,code,msg)=>iss.push({level,code,msg});
  const minIoU=o.minIoU||0.85,maxDx=o.maxDx||6,maxDy=o.maxDy||3;
  const mask=f=>{const w=f.rows[0].length,h=f.rows.length,m=[];let x0=w,y0=h,x1=-1,y1=-1,n=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const on=f.rows[y][x]!=='.'&&f.rows[y][x]!==' ';m.push(on);if(on){n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
    return {m,w,h,n,cx:(x0+x1)/2,cy:(y0+y1)/2};};
  const ms=frames.map(mask);
  for(let i=0;i+1<frames.length;i++){
    const a=ms[i],b=ms[i+1],la=frames[i].label||i,lb=frames[i+1].label||i+1;
    if(a.w!==b.w||a.h!==b.h){add('error','frame-dims',la+' '+a.w+'x'+a.h+' vs '+lb+' '+b.w+'x'+b.h+' (checklist 6)');continue;}
    let inter=0,uni=0;for(let k=0;k<a.m.length;k++){if(a.m[k]&&b.m[k])inter++;if(a.m[k]||b.m[k])uni++;}
    const iou=uni?inter/uni:1,dx=Math.abs(a.cx-b.cx),dy=Math.abs(a.cy-b.cy);
    if(iou<minIoU)add('warn','iou',la+'->'+lb+' silhouette IoU '+iou.toFixed(2)+' < '+minIoU);
    if(dx>maxDx||dy>maxDy)add('warn','drift',la+'->'+lb+' bbox centre drift '+dx.toFixed(1)+','+dy.toFixed(1)+' px');
    const pa=JSON.stringify(Object.values(frames[i].pal).sort()),pb=JSON.stringify(Object.values(frames[i+1].pal).sort());
    if(pa!==pb)add('warn','frame-pal',la+'->'+lb+' palettes differ (checklist 6)');
  }
  if(frames.length>1)add('info','frames',frames.length+' frame(s)');
  return iss;
}
export function formatIssues(label,iss){
  const lv={error:'ERR ',warn:'WARN',info:'info'};
  return iss.map(i=>'  '+lv[i.level]+' '+i.code.padEnd(14)+' '+i.msg).join('\n');
}
