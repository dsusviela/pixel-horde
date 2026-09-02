// Worst-case render baseline: 300 live enemies around a 4-player party with
// full kits of all three schools, volcano biome with a lava river on screen.
// Counts Canvas2D calls per render() over 120 frames (seeded RNG, so reruns
// on the same file print the same numbers) and prints p50/p95/max plus the
// average count per method.
//   node tools/perf-stress.mjs [file]        file: basename or path (default playground.html)
//   CAP=15000 node tools/perf-stress.mjs     exit 1 when p95 calls/frame > CAP (the standing gate)
//   NOLAVA=1                                 skip the two carved lava rivers
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ARG=process.argv[2];
const FILE=!ARG?ROOT+'/playground.html':(path.isAbsolute(ARG)?ARG:(fs.existsSync(path.resolve(ARG))?path.resolve(ARG):ROOT+'/'+ARG));
const counts={};let counting=false;let areaFill=0,areaImg=0,arcArea=0;
function stubCtx(){
  const c={canvas:{width:1360,height:800}};
  const keys=['fillRect','clearRect','strokeRect','beginPath','arc','moveTo','lineTo','closePath','fill','stroke','save','restore','translate','scale','rotate','drawImage','setTransform','clip','rect','quadraticCurveTo','bezierCurveTo','ellipse','fillText','strokeText','putImageData','setLineDash','arcTo'];
  for(const k of keys)c[k]=function(){if(counting)counts[k]=(counts[k]||0)+1;};
  c.fillRect=function(x,y,w,h){if(counting){counts.fillRect=(counts.fillRect||0)+1;areaFill+=Math.abs(w*h);}};
  c.drawImage=function(img){if(counting){counts.drawImage=(counts.drawImage||0)+1;const n=arguments.length;const w=n>=9?arguments[7]:(n>=5?arguments[3]:img.width),h=n>=9?arguments[8]:(n>=5?arguments[4]:img.height);areaImg+=Math.abs((w||0)*(h||0));}};
  c.arc=function(x,y,r){if(counting){counts.arc=(counts.arc||0)+1;arcArea+=r*r*3.14;}};
  c.createLinearGradient=c.createRadialGradient=()=>({addColorStop(){}});
  c.getImageData=()=>({data:new Uint8ClampedArray(4)});c.measureText=()=>({width:10});
  return c;
}
function stubCanvas(){return {width:1360,height:800,style:{},getContext:()=>stubCtx(),addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1360,height:800})};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const html=fs.readFileSync(FILE,'utf8');const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const pads=[];const M=Object.create(Math);M.random=mulberry32(7);
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
for(let i=0;i<4;i++)pads.push({index:i,connected:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0],mapping:'standard'});
const G=ev('G');G.state='title';for(let i=0;i<4;i++)ev('joinPlayer')(i,0);ev('startRun')('classic');
const update=ev('update'),render=ev('render'),spawnEnemy=ev('spawnEnemy'),carveRiver=ev('carveRiver'),setBiome=ev('setBiome'),setTerrain=ev('setTerrain');
G.state='play';G.waveState='fight';G.wave=8;
setBiome('volcano');setTerrain('pressure');
const kits=[
  ['destro',['lavaray','meteor','cflame','evocation'],{ba:3,hh:2,cr:2}],
  ['illusion',['arcmissile','eblast','shocking','mirage','assassin'],{mirror:4,ka:2}],
  ['necro',['shadowb','decay','plague','inflict','souls'],{leech:2,dtouch:2}],
  ['illusion',['arcmissile','eblast','shocking','mirage'],{mirror:2,ka:1}]];
G.players.forEach((p,i)=>{const k=kits[i];p.school=k[0];for(const id of k[1])p.weapons[id]={lv:4,t:0,ang:0,evo:id!=='evocation'&&id!=='assassin'&&id!=='souls'};Object.assign(p.pas,k[2]);p.weapons.blaster.lv=4;});
const cx=G.cam.x,cy=G.cam.y;
if(!process.env.NOLAVA){G.lava=new Set();carveRiver(cx-200,cy-120,0,{x:cx,y:cy,w:900,h:520},{width:3,jitter:0.4});carveRiver(cx+150,cy+80,2,{x:cx,y:cy,w:900,h:520},{width:3,jitter:0.4});}
const types=['chaser','swarm','spitter','tank','bomber','smasher','burster','fireslug'];
for(let i=0;i<300;i++){const a=i*2.399,r=110+((i*37)%220);const e=spawnEnemy(types[i%8],cx+Math.cos(a)*r*1.4,cy+Math.sin(a)*r,i%9===0?2:0);e.hp=e.maxhp=1e7;}
const dt=1/60;const samples=[];
for(let f=0;f<420;f++){
  for(const p of G.players){p.hp=p.maxhp;p.invuln=0;p.dead=false;const pad=pads[p.padIndex];const a=G.time*0.9+p.idx*Math.PI/2;const tx=cx+Math.cos(a)*90,ty=cy+Math.sin(a)*60;const d=Math.hypot(tx-p.x,ty-p.y)||1;pad.axes[0]=(tx-p.x)/d;pad.axes[1]=(ty-p.y)/d;}
  for(const e of G.enemies){if(!e.dead){e.hp=e.maxhp=1e7;const d=Math.hypot(e.x-cx,e.y-cy);if(d>420){e.x=cx+(e.x-cx)*0.3;e.y=cy+(e.y-cy)*0.3;}}}
  G.state='play';
  update(dt);
  if(f>=300){
    for(const k in counts)delete counts[k];areaFill=areaImg=arcArea=0;counting=true;
    const t0=process.hrtime.bigint();render();const ms=Number(process.hrtime.bigint()-t0)/1e6;counting=false;
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    samples.push({f,e:G.enemies.filter(e=>!e.dead).length,b:G.bullets.length,pt:G.particles.length,fx:G.fx.length,lava:G.lava?G.lava.size:0,vw:ev('view.width'),vh:ev('view.height'),total,jsMs:+ms.toFixed(2),areaFill:Math.round(areaFill),areaImg:Math.round(areaImg),arcArea:Math.round(arcArea),counts:Object.assign({},counts)});
  }
}
const sorted=[...samples].sort((a,b)=>a.total-b.total);
const p50=sorted[Math.floor(sorted.length*0.5)],p95=sorted[Math.floor(sorted.length*0.95)],max=sorted[sorted.length-1];
const avgC={};for(const s of samples)for(const k in s.counts)avgC[k]=(avgC[k]||0)+s.counts[k]/samples.length;
for(const k in avgC)avgC[k]=Math.round(avgC[k]);
const out={file:path.basename(FILE),frames:samples.length,p50:p50.total,p95:p95.total,max:max.total,avgJsMs:+(samples.reduce((a,s)=>a+s.jsMs,0)/samples.length).toFixed(2),state:{e:max.e,b:max.b,pt:max.pt,fx:max.fx,lava:max.lava,vw:max.vw,vh:max.vh},avgAreaFill:Math.round(samples.reduce((a,s)=>a+s.areaFill,0)/samples.length),avgAreaImg:Math.round(samples.reduce((a,s)=>a+s.areaImg,0)/samples.length),avgArcArea:Math.round(samples.reduce((a,s)=>a+s.arcArea,0)/samples.length),avgCounts:avgC};
console.log(JSON.stringify(out,null,1));
const CAP=+(process.env.CAP||0);
if(CAP&&p95.total>CAP){console.log('FAIL p95 calls/frame '+p95.total+' > cap '+CAP);process.exit(1);}
