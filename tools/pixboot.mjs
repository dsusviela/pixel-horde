// Shared sandbox for the software-canvas tools (frame.mjs, sheet.mjs).
// Boots a workspace html file (default playground.html, read at run time so it
// always reflects the CURRENT file) inside a vm with PixCanvas standing in for
// every canvas, the same seeded mulberry32 Math.random the test harness uses,
// and stub audio/DOM. Before boot the script can be patched:
//   - inject: art modules (see applyInject below) — the §1.3 delivery format
//   - patch(src): any exact-string edit function (rep helper exported)
// Never edit tools/headless.mjs for this — the harness keeps the RNG order.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {PixCanvas,readPng} from './pixcanvas.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const CRLF=s=>s.split('\r\n').join('\n').split('\n').join('\r\n');
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function resolveFile(file){
  if(!file)return ROOT+'/playground.html';
  if(path.isAbsolute(file))return file;
  if(fs.existsSync(path.resolve(file)))return path.resolve(file);
  return ROOT+'/'+file;
}
export function extractScript(file){
  const html=fs.readFileSync(file,'utf8');
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  if(!m)throw new Error('no <script> block in '+file);
  return m[1];
}
// exact-string replace on a CRLF source; both needles are normalised
export function rep(src,a,b){a=CRLF(a);b=CRLF(b);if(!src.includes(a))throw new Error('anchor missing: '+a.slice(0,70));return src.replace(a,b);}

// ---- art-module injection (plan §1.3) ----
// A module's default export maps const names to specs:
//   name:{rows:[...],pal:{..}|'MAT.x'|'pal(MAT.x,{..})',den:2,after:'anchorConst',note:'..'}
//     -> replaces `const name=makeSprite(...);` (or `const name=[...];` for a
//        rows array such as PLAYER_ROWS) in place; a name not in the file is
//        appended after the statement `const <after>=...;` (default anchor:
//        lavaTileSprite, i.e. right after the overlay sprites)
//   name:{literal:'const name=...;'}  -> the exact statement, same placement rule
//   __patches:[[find,replace],...]     -> extra exact-string edits (CRLF-normalised)
// Returns {src,literals} — literals are the pasted-ready statements.
const STMT=name=>new RegExp('const '+name+'=[\\s\\S]*?;(?=[ \\t]*(?://[^\\r\\n]*)?(?:\\r?\\n|$))'); // a trailing // note after the ; ends the statement too
export function injectSpecs(src,specs,tag){
  const literals=[];
  const after=specs.__after||'lavaTileSprite';
  for(const [name,spec] of Object.entries(specs)){
    if(name.startsWith('__'))continue;
    let lit;
    const rowsOnly=spec.rows&&!spec.pal&&new RegExp('const '+name+'=\\[').test(src);
    if(spec.literal)lit=spec.literal.trim();
    else if(rowsOnly)lit='const '+name+'='+JSON.stringify(spec.rows)+';';
    else{
      if(!spec.rows)throw new Error(tag+': '+name+' needs rows or literal');
      const pal=typeof spec.pal==='string'?spec.pal:JSON.stringify(spec.pal||{});
      lit='const '+name+'=makeSprite('+JSON.stringify(spec.rows)+','+pal+(spec.den?','+spec.den:'')+');';
      if(spec.note)lit+=' // '+spec.note;
    }
    literals.push(lit);
    const re=STMT(name);
    if(re.test(src))src=src.replace(re,CRLF(lit));
    else{
      const an=STMT(spec.after||after),m=src.match(an);
      if(!m)throw new Error(tag+': anchor const '+(spec.after||after)+' not found for new const '+name);
      src=src.slice(0,m.index+m[0].length)+'\r\n'+CRLF(lit)+src.slice(m.index+m[0].length);
    }
  }
  for(const [a,b] of (specs.__patches||[]))src=rep(src,a,b);
  return {src,literals};
}
export async function applyInject(src,modulePaths){
  const literals=[];
  for(const mp of modulePaths){
    const abs=path.isAbsolute(mp)?mp:path.resolve(mp);
    const mod=await import(pathToFileURL(abs).href+'?t='+Date.now());
    const specs=mod.default||mod;
    const r=injectSpecs(src,specs,path.basename(mp));
    src=r.src;literals.push(...r.literals);
  }
  return {src,literals};
}

// ---- the sandbox ----
// opts: {file, src, seed, search, screenW, screenH, patch(src)->src}
export function bootPix(opts={}){
  const file=resolveFile(opts.file);
  let src=opts.src||extractScript(file);
  if(opts.patch)src=opts.patch(src);
  const screen=new PixCanvas(opts.screenW||1360,opts.screenH||800);
  const pads=[];
  const M=Object.create(Math);M.random=mulberry32(opts.seed===undefined?1:opts.seed);
  const sandbox={console,Math:M,JSON,Date,Set,Map,WeakSet,WeakMap,Array,Object,String,Number,Boolean,Error,Promise,
    Uint8ClampedArray,Uint8Array,Float32Array,Int32Array,isNaN,isFinite,parseInt,parseFloat,
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    navigator:{getGamepads:()=>pads},
    AudioContext:function(){return{currentTime:0,state:'running',destination:{},sampleRate:44100,
      createOscillator:()=>({connect:()=>{},start:()=>{},stop:()=>{},frequency:{setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},type:''}),
      createGain:()=>({connect:()=>{},gain:{setValueAtTime:()=>{},setTargetAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},cancelScheduledValues:()=>{},value:0}}),
      createBuffer:()=>({getChannelData:()=>new Float32Array(64)}),
      createBufferSource:()=>({connect:()=>{},start:()=>{},stop:()=>{},buffer:null}),
      createBiquadFilter:()=>({connect:()=>{},frequency:{setValueAtTime:()=>{}},type:'',Q:{value:0}}),
      resume:()=>Promise.resolve()};},
    location:{search:opts.search||'',protocol:'file:',href:'file:///'+path.basename(file)+(opts.search||'')},
  };
  // Image: decodes a data: PNG synchronously through readPng so atlas-backed
  // sprites (tools/art/*.mjs) fill in at boot exactly like makeSprite art
  sandbox.Image=class{constructor(){this.onload=null;this._src='';}
    set src(v){this._src=v;const m=/^data:image\/png;base64,(.*)$/.exec(v);if(!m)throw new Error('sandbox Image: data:image/png;base64 only');
      const im=readPng(Buffer.from(m[1],'base64'));this.width=im.width;this.height=im.height;this.get=(x,y)=>im.get(x,y);if(this.onload)this.onload();}
    get src(){return this._src;}};
  sandbox.addEventListener=()=>{};sandbox.removeEventListener=()=>{};
  sandbox.innerWidth=screen.width;sandbox.innerHeight=screen.height;sandbox.devicePixelRatio=1;
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  sandbox.document={getElementById:()=>screen,createElement:t=>t==='canvas'?new PixCanvas(1,1):{style:{},appendChild:()=>{}},
    addEventListener:()=>{},body:{appendChild:()=>{},style:{}},documentElement:{style:{}}};
  const vmctx=vm.createContext(sandbox);
  vm.runInContext(src,vmctx,{filename:path.basename(file)});
  const ev=e=>vm.runInContext(e,vmctx);
  return {file,src,screen,pads,vmctx,ev,sandbox,
    get G(){return ev('G');},
    has(name){return ev('typeof '+name+'!=="undefined"');},
    addPad(){pads.push({index:pads.length,connected:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0],mapping:'standard'});},
  };
}

// ---- small arg parser shared by the tools ----
// BOOL flags take no value; everything else `--k v`; bare words are positionals
export function parseArgs(argv,BOOL){
  const o={_:[]};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a.startsWith('--')){const k=a.slice(2);if(BOOL.has(k)||i+1>=argv.length||argv[i+1].startsWith('--'))o[k]=true;else o[k]=argv[++i];}
    else o._.push(a);
  }
  return o;
}
export function writePng(canvas,out){
  const abs=path.resolve(out);
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,canvas.png());
  console.log('wrote',abs,canvas.width+'x'+canvas.height);
  return abs;
}
// box-filter downsample by an integer K (alpha-weighted colour average)
export function downsample(src,K){
  const w=Math.floor(src.width/K),h=Math.floor(src.height/K),out=new PixCanvas(w,h),d=out.data,s=src.data,sw=src.width;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let r=0,g=0,b=0,a=0;
    for(let j=0;j<K;j++)for(let i=0;i<K;i++){const o=((y*K+j)*sw+x*K+i)*4,al=s[o+3];r+=s[o]*al;g+=s[o+1]*al;b+=s[o+2]*al;a+=al;}
    const o=(y*w+x)*4;if(a>0){d[o]=r/a;d[o+1]=g/a;d[o+2]=b/a;}d[o+3]=a/(K*K);
  }
  return out;
}
// nearest upscale by an integer Z
export function upscale(src,Z){
  if(Z===1)return src;
  const out=new PixCanvas(src.width*Z,src.height*Z);
  out.getContext('2d').drawImage(src,0,0,src.width*Z,src.height*Z);
  return out;
}
// mean/max abs channel diff and % of pixels with any channel > 8 apart
export function comparePng(a,b){
  if(a.width!==b.width||a.height!==b.height)return {error:'size mismatch '+a.width+'x'+a.height+' vs '+b.width+'x'+b.height};
  let sum=0,max=0,over=0;const n=a.width*a.height;
  for(let i=0;i<n;i++){
    const o=i*4;let px=0;
    for(let c=0;c<3;c++){const d=Math.abs(a.data[o+c]*a.data[o+3]-b.data[o+c]*b.data[o+3]);sum+=d;if(d>max)max=d;if(d>px)px=d;}
    if(px>8)over++;
  }
  return {mean:sum/(n*3),max,pctOver8:100*over/n,pixels:n};
}
