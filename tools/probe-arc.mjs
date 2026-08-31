// Arc timeline probe: every flash/subFlash (and whether it overwrote one still on
// screen), level-up pauses and their cards, boss casts, deaths with hp loss by
// source, and the arc metrics (wave-2 slams, forge feeds / end, wave-4 discs).
//   node tools/probe-arc.mjs [seed] [players] [dmgMul] [immortal|mortal] [dodge]
// 'dodge' makes the bot walk out of orange telegraph discs; default it kites at ~90px.
// Timeline probe for THE RAID (waves 1-10): every flash/subFlash, level-ups, damage by source.
import {boot} from './headless.mjs';
const seed=+(process.argv[2]||7), NP=+(process.argv[3]||1), DMG=+(process.argv[4]||1), IMMORTAL=process.argv[5]==='immortal';const DODGE=process.argv[6]==='dodge';
const g=boot(seed);
for(let i=0;i<NP;i++)g.addPad();
g.G.state='title';
for(let i=0;i<NP;i++)g.ev('joinPlayer')(i,0);
g.ev('startRun')('classic');
const G=g.G;
const dt=1/60;
let lastFlash=null,lastSub=null,lastState=null,lastWave=0,subOverwrites=0,lastSubT=0;
const log=(s)=>console.log(`${G.time.toFixed(1).padStart(6)}s w${G.wave} ${s}`);
let lvl=0,levelPauses=0;const M={slams:0,pops:0,feeds:0,forgeMinHp:1,forgeEnd:'',safe:0,inward:0,brandPools:0,augurEnd:'',fights:{}};const castSeen=new WeakSet();const smState=new WeakMap();
const dmg={};let prevHp={},deaths=0;
for(let f=0;f<60*900;f++){
  if(G.state==='levelup'){
    levelPauses++;
    const kinds=G.levelupPicks[0].offers.map(o=>o.kind+':'+o.id).join(', ');
    log(`LEVELUP pause #${levelPauses} (lv ${G.level}) cards: ${kinds}`);
    for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);
    if(G.levelupPicks.every(p=>p.done))g.ev('finishLevelup')();
    continue;
  }
  for(const p of G.players){
    const pad=g.pads[p.padIndex];if(!pad)continue;
    // naive new player: walk at the nearest enemy, never read telegraphs
    let best=null,bd=1e12;
    for(const e of G.enemies){if(e.dead||e.vulnMul===0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e;}}
    // kiting player: keep ~90px from the nearest threat, drift toward it beyond
    // that — EXCEPT offerings/shards during a boss: those are harmless and the
    // taught play is to intercept them, so the bot walks straight onto the line
    let off=null,od=1e12;
    if(G.boss&&!G.boss.dead)for(const e of G.enemies){if(e.dead||!(e.offering||e.shard))continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<od){od=d;off=e;}}
    if(off){const d=Math.sqrt(od)||1;pad.axes[0]=(off.x-p.x)/d;pad.axes[1]=(off.y-p.y)/d;}
    else if(best){const d=Math.sqrt(bd)||1;const s=d<90?-1:(d>130?1:0);pad.axes[0]=s*(best.x-p.x)/d;pad.axes[1]=s*(best.y-p.y)/d;}
    else{pad.axes[0]=0;pad.axes[1]=0;}
    // the dodging player: standing in an orange disc → walk straight out of it
    if(DODGE){let tel=null,td=1e9;for(const x of G.fx){if(x.kind==='tel'&&x.t>0){const dd=(p.x-x.x)**2+(p.y-x.y)**2;if(dd<(x.r+12)**2&&dd<td){td=dd;tel=x;}}}
      if(tel){const dd=Math.sqrt(td)||1;pad.axes[0]=(p.x-tel.x)/dd;pad.axes[1]=(p.y-tel.y)/dd;}}
    p.dmgMul=DMG; if(IMMORTAL){p.hp=p.maxhp;}
    prevHp[p.idx]=p.hp;
  }
  g.step(dt);
  if(f%9===0)g.render();
  // arc metrics
  if(G.waveState==='fight')M.fights[G.wave]=(M.fights[G.wave]||0)+dt;
  for(const e of G.enemies){
    if(e.sm){const ls=smState.get(e);if(e.sm.st==='cast'&&ls!=='cast')M.slams++;smState.set(e,e.sm.st);}
    if(e.type==='burster'){const ls=smState.get(e);if(e.fuse>=0&&ls!=='f')M.pops++;smState.set(e,e.fuse>=0?'f':'h');}
  }
  if(G.wavePat&&G.wavePat.forge){const Fg=G.wavePat.forge;M.feeds=Math.max(M.feeds,Fg.heat);if(Fg.e&&!Fg.e.dead)M.forgeMinHp=Math.min(M.forgeMinHp,Fg.e.hp/Fg.e.maxhp);if(Fg.st!=='idle')M.forgeEnd=Fg.st+'@'+G.waveT.toFixed(0)+'s';}
  for(const x of G.fx){
    if(x.kind==='safe'&&!castSeen.has(x)){castSeen.add(x);M.safe++;}
    if(x.kind==='ring'&&x.dir<0&&x.spd>1&&!castSeen.has(x)){castSeen.add(x);M.inward++;}
    if(x.kind==='pool'&&x.col==='#ff3c3c'&&x.r>=40&&!castSeen.has(x)){castSeen.add(x);M.brandPools++;}
  }
  if(G.wavePat&&G.wavePat.aug&&G.wavePat.aug.st!=='live'&&G.wavePat.aug.st!=='idle')M.augurEnd=G.wavePat.aug.st;
  if(G.wavePat&&G.wavePat.aug&&G.wavePat.aug.e&&G.wavePat.aug.e.dead&&!M.augurEnd)M.augurEnd=G.wavePat.aug.st;
  for(const p of G.players){
    const lost=(prevHp[p.idx]??p.hp)-p.hp;
    if(lost>0.01&&!IMMORTAL){
      let src='?';
      const tk=Math.floor(p.x/16)+','+Math.floor(p.y/16);
      if(G.lava&&G.lava.has(tk))src='lava tile';
      else{
        const boom=G.fx.find(f=>f.kind==='boom'&&f.t>0&&(p.x-f.x)**2+(p.y-f.y)**2<(f.r+4)**2);
        const pool=G.fx.find(f=>f.kind==='pool'&&f.t>0&&(p.x-f.x)**2+(p.y-f.y)**2<(f.r+4)**2);
        const bul=G.ebullets.find(b=>(p.x-b.x)**2+(p.y-b.y)**2<14*14);
        let ne=null,nd=1e9;for(const e of G.enemies){if(e.dead)continue;const d=(p.x-e.x)**2+(p.y-e.y)**2;if(d<nd){nd=d;ne=e;}}
        if(boom)src='boom(slam/pop)';else if(bul)src='bullet '+(bul.col||'');else if(pool)src='pool '+pool.col;else if(ne&&nd<(ne.r+8)**2)src='touch '+(ne.name||ne.type);else src='? nearest '+(ne?ne.type+'@'+Math.sqrt(nd).toFixed(0):'none');
      }
      const k='w'+G.wave+' '+src;dmg[k]=(dmg[k]||0)+lost;
    }
    if(p.dead&&prevHp[p.idx]>0){deaths++;log(`P${p.idx+1} DIED hp-loss by source so far: `+JSON.stringify(Object.fromEntries(Object.entries(dmg).map(([k,v])=>[k,Math.round(v)]))));}
  }
  if(G.wave!==lastWave){lastWave=G.wave;log(`--- WAVE ${G.wave} (${G.waveState}) party lv ${G.level}`);}
  if(G.waveState!==lastState){lastState=G.waveState;log(`state=${G.waveState}`);}
  if(G.flashMsg!==lastFlash&&G.flashT>2.1){lastFlash=G.flashMsg;log(`FLASH   "${G.flashMsg}"`);}
  if(G.subFlash!==lastSub&&G.subFlashT>0){
    if(lastSub&&lastSubT>0.3)subOverwrites++;
    lastSub=G.subFlash;log(`  sub   "${G.subFlash}" (${G.subFlashT.toFixed(1)}s)${lastSubT>0.3?'  <-- replaced previous sub with '+lastSubT.toFixed(1)+'s left':''}`);
  }
  lastSubT=G.subFlashT;
  if(G.boss&&!G.boss.dead&&G.boss.castName&&G.boss._lastCast!==G.boss.castName){G.boss._lastCast=G.boss.castName;log(`  boss cast ${G.boss.castName} (phase ${G.boss.phase})`);}
  if(G.wave>=11)break;
  if(G.state==='gameover'){log('GAME OVER');break;}
}
log(`done. level pauses=${levelPauses}, sub overwrites=${subOverwrites}, deaths=${deaths}`);
console.log('ARC METRICS',JSON.stringify({...M,forgeMinHp:+M.forgeMinHp.toFixed(2),fights:Object.fromEntries(Object.entries(M.fights).map(([k,v])=>[k,Math.round(v)]))}));
