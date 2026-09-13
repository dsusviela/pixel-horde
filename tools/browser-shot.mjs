// Real-browser frames of the game through Edge headless + the DevTools protocol
// (node 22: global fetch/WebSocket, no npm deps). Unlike frame.mjs (software
// canvas: no text, no gradients) this captures the whole screen pass — HUD,
// damage numbers, vignettes — at TV resolution.
//
//   node tools/browser-shot.mjs <outPrefix> [file=playground.html] [wave=2] [W=1920] [H=1080] [biome]
//
// Boots the file, joins one keyboard player, starts a classic run at --wave,
// auto-resolves every draft (like frame.mjs) and keeps the hero topped up for
// ~9s while the wave arrives. Then, with the hero standing still:
//   <prefix>-0-calm.png       full hp
//   <prefix>-1-hit.png        right after a 15% hurtPlayer from the right
//   <prefix>-2-hit150ms.png   ~150ms later (red tint draining, HUD ghost)
//   <prefix>-3-bighit.png     a 30% bossHit (hitstop, white outlined number)
//   <prefix>-4-lowhp.png      hero at 22% (low-hp breathing + HUD pulse)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const [out='shot',file='playground.html',wave='2',W='1920',H='1080',biome]=process.argv.slice(2);
const EDGE=process.env.EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT=+(process.env.CDP_PORT||9333);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=path.resolve(root,file);
const URL='file:///'+html.replace(/\\/g,'/')+'?wave='+wave;
const prof=path.join(root,'tools','.edge-profile');
const edge=spawn(EDGE,['--headless=new','--remote-debugging-port='+PORT,'--window-size='+W+','+H,'--allow-file-access-from-files','--disable-gpu','--hide-scrollbars','--no-first-run','--user-data-dir='+prof,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let targets=null;
for(let i=0;i<50&&!targets;i++){try{targets=await (await fetch('http://127.0.0.1:'+PORT+'/json')).json();}catch(e){await sleep(200);}}
if(!targets){edge.kill();throw new Error('edge did not answer on '+PORT);}
const page=targets.find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const pending={};
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];}else if(m.method==='Runtime.exceptionThrown')console.log('PAGE EXC',JSON.stringify(m.params.exceptionDetails).slice(0,300));};
const send=(method,params={})=>new Promise(r=>{const i=++id;pending[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result.exceptionDetails)console.log('EVAL EXC',expr.slice(0,80),JSON.stringify(r.result.exceptionDetails).slice(0,300));return r.result.result&&r.result.result.value;};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'-'+name+'.png',Buffer.from(r.result.data,'base64'));console.log('wrote',out+'-'+name+'.png');};
try{
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:+W,height:+H,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:URL});
  await sleep(1500);
  await ev("G.state='title';joinPlayer(0,0);startRun('classic');G.state");
  await ev("window.__auto=setInterval(()=>{if(G.state==='levelup'){for(const pick of G.levelupPicks)if(!pick.done)takeOffer(pick,true);if(G.levelupPicks.every(p=>p.done))finishLevelup();}if(!window.__stopHeal)for(const p of G.players){p.hp=p.maxhp;p.hpGhost=p.hp;}},16);1");
  await sleep(9000);
  await ev("window.__stopHeal=1");
  if(biome){await ev("setBiome('"+biome+"');1");await sleep(400);}
  console.log('play',await ev("JSON.stringify({state:G.state,wave:G.wave,enemies:G.enemies.filter(e=>!e.dead).length,hp:G.players[0].hp,max:G.players[0].maxhp})"));
  // Park the game loop: captureScreenshot alone costs ~350ms of sim time, which
  // outlives every hit timer. From here the loop only advances when stepped.
  await ev("window.__raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.__cb=cb;};1");
  await sleep(100);
  const step=()=>ev("new Promise(r=>window.__raf(t=>{const cb=window.__cb;window.__cb=null;cb(t);r(G.time);}))");
  const stepFor=async s=>{const t0=await ev("G.time");let t=t0;while(t-t0<s)t=await step();return t-t0;};
  await ev("for(const p of G.players){p.hp=p.maxhp;p.hpGhost=p.hp;p.invuln=0;p.hurtCd=0;}G.hurtV=0;G.texts.length=0");
  await stepFor(0.3);
  await shot('0-calm');
  await ev("{const p=G.players[0];p.invuln=0;p.hurtCd=0;hurtPlayer(p,p.maxhp*0.15,p.x+30,p.y);}");
  await step();
  await shot('1-hit');
  await stepFor(0.12);
  await shot('2-hit150ms');
  await stepFor(0.6);
  await ev("{const p=G.players[0];p.invuln=0;p.hurtCd=0;bossHit(p,0.30);}");
  await step();
  await shot('3-bighit');
  await stepFor(1.2);
  await ev("for(const p of G.players){p.hp=p.maxhp*0.22;p.hpGhost=p.hp;}G.hurtV=0;G.texts.length=0");
  await stepFor(0.3);
  await shot('4-lowhp');
}finally{ws.close();edge.kill();}
