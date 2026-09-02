// Counts Canvas2D calls per render() at busy frames of a normal playground run
// (every 10th frame, the party circling, seeded RNG) so the visual revamp has a
// measured baseline: avg/p95 calls per frame, the busiest sample, the top 5.
//   NP=4 node tools/perf-calls.mjs [file]   NP: party size (default 4); file: basename or path
//   FRAMES=14400                           sim frames (default 240 s)
//   CAP=4000                               exit 1 when p95 calls/frame > CAP
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARG=process.argv[2];
const FILE=!ARG?ROOT+'/playground.html':(path.isAbsolute(ARG)?ARG:(fs.existsSync(path.resolve(ARG))?path.resolve(ARG):ROOT+'/'+ARG));
const NP=+(process.env.NP||4);
const FRAMES=+(process.env.FRAMES||60*240);
const counts={};
let counting=false;
let areaFill=0,areaImg=0,arcs=0;
function stubCtx(){
  const c={canvas:{width:1360,height:800},_lw:1};
  const keys=['fillRect','clearRect','strokeRect','beginPath','arc','moveTo','lineTo','closePath',
    'fill','stroke','save','restore','translate','scale','rotate','drawImage','setTransform',
    'clip','rect','quadraticCurveTo','bezierCurveTo','ellipse','fillText','strokeText','putImageData','setLineDash','arcTo'];
  for(const k of keys)c[k]=function(){if(counting)counts[k]=(counts[k]||0)+1;};
  c.fillRect=function(x,y,w,h){if(counting){counts.fillRect=(counts.fillRect||0)+1;areaFill+=Math.abs(w*h);}};
  c.drawImage=function(img,a,b,cc,d,e,f,g,h){if(counting){counts.drawImage=(counts.drawImage||0)+1;const w=arguments.length>=9?g:(arguments.length>=5?cc:img.width),hh=arguments.length>=9?h:(arguments.length>=5?d:img.height);areaImg+=Math.abs((w||0)*(hh||0));}};
  c.arc=function(x,y,r){if(counting){counts.arc=(counts.arc||0)+1;arcs+=r*r*3.14;}};
  c.createLinearGradient=c.createRadialGradient=()=>({addColorStop(){}});
  c.getImageData=()=>({data:new Uint8ClampedArray(4)});
  c.measureText=()=>({width:10});
  return c;
}
function stubCanvas(){return {width:1360,height:800,style:{},getContext:()=>stubCtx(),addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1360,height:800})};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const html=fs.readFileSync(FILE,'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const pads=[];const M=Object.create(Math);M.random=mulberry32(40+NP);
const sandbox={console,Math:M,JSON,Date,Set,Map,Array,Object,String,Number,Boolean,Uint8ClampedArray,Float32Array,isNaN,parseInt,parseFloat,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{getGamepads:()=>pads},
  AudioContext:function(){return{currentTime:0,state:'running',destination:{},sampleRate:44100,
    createOscillator:()=>({connect(){},start(){},stop(){},frequency:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},type:''}),
    createGain:()=>({connect(){},gain:{setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},value:0}}),
    createBuffer:()=>({getChannelData:()=>new Float32Array(64)}),createBufferSource:()=>({connect(){},start(){},stop(){},buffer:null}),
    createBiquadFilter:()=>({connect(){},frequency:{setValueAtTime(){}},type:'',Q:{value:0}}),resume:()=>Promise.resolve()};},
  location:{search:'',protocol:'file:',href:'file:///x'}};
sandbox.addEventListener=()=>{};sandbox.removeEventListener=()=>{};sandbox.innerWidth=1360;sandbox.innerHeight=800;sandbox.devicePixelRatio=1;
sandbox.window=sandbox;sandbox.globalThis=sandbox;
sandbox.document={getElementById:()=>stubCanvas(),createElement:t=>t==='canvas'?stubCanvas():{style:{},appendChild(){}},addEventListener(){},body:{appendChild(){},style:{}},documentElement:{style:{}}};
const vctx=vm.createContext(sandbox);vm.runInContext(src,vctx,{filename:'playground.html'});
const ev=e=>vm.runInContext(e,vctx);
for(let i=0;i<NP;i++)pads.push({index:i,connected:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0],mapping:'standard'});
const G=ev('G');G.state='title';for(let i=0;i<NP;i++)ev('joinPlayer')(i,0);ev('startRun')('classic');
const update=ev('update'),render=ev('render'),takeOffer=ev('takeOffer'),finishLevelup=ev('finishLevelup');
const dt=1/60;let best=null;const samples=[];
for(let f=0;f<FRAMES;f++){
  for(const p of G.players){p.hp=p.maxhp;p.invuln=1;p.dmgMul=G.wave<10?1.25:3.5;}
  if(G.state==='levelup'){for(const pick of G.levelupPicks)if(!pick.done)takeOffer(pick,true);if(G.levelupPicks.every(p=>p.done))finishLevelup();continue;}
  for(const p of G.players){const pad=pads[p.padIndex];const a=G.time*0.55+p.idx*Math.PI*2/NP;const tx=G.cam.x+Math.cos(a)*150,ty=G.cam.y+Math.sin(a)*90;const d=Math.hypot(tx-p.x,ty-p.y)||1;if(d>20){pad.axes[0]=(tx-p.x)/d;pad.axes[1]=(ty-p.y)/d;}else{pad.axes[0]=0;pad.axes[1]=0;}}
  update(dt);
  if(f%10===0){
    for(const k in counts)delete counts[k];areaFill=areaImg=arcs=0;counting=true;
    const t0=process.hrtime.bigint();render();const ms=Number(process.hrtime.bigint()-t0)/1e6;counting=false;
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    const s={f,wave:G.wave,e:G.enemies.filter(e=>!e.dead).length,b:G.bullets.length,pt:G.particles.length,fx:G.fx.length,lava:G.lava?G.lava.size:0,camw:Math.round(G.cam.w),vw:ev('view.width'),vh:ev('view.height'),total,jsMs:ms,areaFill:Math.round(areaFill),areaImg:Math.round(areaImg),arcArea:Math.round(arcs),counts:Object.assign({},counts)};
    samples.push(s);if(!best||total>best.total)best=s;
  }
  if(G.state==='victory')break;
}
const p95=[...samples].sort((a,b)=>a.total-b.total)[Math.floor(samples.length*0.95)];
const avg=samples.reduce((a,s)=>a+s.total,0)/samples.length;
console.log('NP',NP,'samples',samples.length,'avg calls/frame',avg.toFixed(0),'p95',p95.total,'jsMs(avg)',(samples.reduce((a,s)=>a+s.jsMs,0)/samples.length).toFixed(2));
console.log('BUSIEST',JSON.stringify(best,null,1));
const topN=[...samples].sort((a,b)=>b.total-a.total).slice(0,5).map(s=>({f:s.f,w:s.wave,e:s.e,b:s.b,pt:s.pt,fx:s.fx,lava:s.lava,total:s.total,fillRect:s.counts.fillRect,stroke:s.counts.stroke,arc:s.counts.arc,drawImage:s.counts.drawImage,ellipse:s.counts.ellipse,clip:s.counts.clip}));
console.log('TOP5',JSON.stringify(topN));
const CAP=+(process.env.CAP||0);
if(CAP&&p95.total>CAP){console.log('FAIL p95 calls/frame '+p95.total+' > cap '+CAP);process.exit(1);}
