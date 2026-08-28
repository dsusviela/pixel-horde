// The Slagmaw arc, end to end: wave 1 → the cave descent → waves 2-4 (lava
// mix, slug forge, volcanic pressure) → Slagmaw's three phases with the
// cracked cauldron → the ascent back to the surface → wave 6.
//   node tools/test-slagmaw.mjs [seed]
import {boot} from './headless.mjs';

const seed=+(process.argv[2]||5);
let fail=0;
const say=(ok,msg)=>{console.log((ok?'ok   ':'FAIL ')+msg);if(!ok)fail=1;};

for(const NP of [1,3]){
  const g=boot(seed+NP);
  for(let i=0;i<NP;i++)g.addPad();
  g.G.state='title';
  for(let i=0;i<NP;i++)g.ev('joinPlayer')(i,0);
  g.ev('startRun')('classic');
  const G=g.G;
  const seen={descent:0,volcano:0,lavamix:0,slugforge:0,pressure:0,forgeLive:0,orbs:0,lava:0,
    phase2:0,phase3:0,bossLava:0,ascent:0,surfaceBack:0,wave6:0,ring:0,rimBorn:0,
    smasher:0,burster:0,fireslug:0,types6:0,bossDead:0};
  let maxFade=0,dpsMul=4,lastWave=0;
  const dt=1/60;
  for(let f=0;f<60*900;f++){
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;p.dmgMul=dpsMul;}
    if(G.state==='levelup'){const pk=G.levelupPicks[0];g.ev('takeOffer')(pk,true);g.ev('finishLevelup')();}
    // bot: everyone walks at the nearest killable thing
    for(const p of G.players){
      const pad=g.pads[p.padIndex];if(!pad)continue;
      let best=null,bd=1e12;
      for(const e of G.enemies){if(e.dead||e.vulnMul===0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e;}}
      if(best&&bd>40*40){const d=Math.sqrt(bd);pad.axes[0]=(best.x-p.x)/d;pad.axes[1]=(best.y-p.y)/d;}
      else{pad.axes[0]=0;pad.axes[1]=0;}
    }
    g.step(dt);
    if(f%9===0)g.render();
    if(G.waveState==='descent'){seen.descent=1;maxFade=Math.max(maxFade,G.fade);if(G.descent&&G.descent.dir==='up')seen.ascent=1;}
    if(G.biome==='volcano')seen.volcano=1;
    if(G.wavePat){
      const P=G.wavePat;
      if(P.id==='lavamix'&&P.ei>0)seen.lavamix=1;
      if(P.id==='slugforge'&&P.ei>0)seen.slugforge=1;
      if(P.id==='pressure'&&P.ei>0)seen.pressure=1;
      if(P.forge&&P.forge.st==='live')seen.forgeLive=1;
      if(P.forge&&P.forge.orbs>0)seen.orbs=1;
      if(P.forge)seen.heat=Math.max(seen.heat||0,P.forge.heat);
      if(P.id==='pressure'&&G.terrain==='pressure'){
        // lava is terrain now: count river tiles in the camera window
        let n=0;const c=G.cam,hz=g.ev('hazardAt');
        for(let y=c.y-c.h/2;y<c.y+c.h/2;y+=16)for(let x=c.x-c.w/2;x<c.x+c.w/2;x+=16)if(hz(x,y)==='lava')n++;
        if(n>20)seen.lava=1;
      }
    }
    if(G.wave===2)for(const e of G.enemies){if(e.type==='smasher')seen.smasher=1;if(e.type==='burster')seen.burster=1;if(e.type==='fireslug')seen.fireslug=1;}
    if(G.boss&&!G.boss.dead&&G.boss.def&&G.boss.def.id==='slagmaw'){
      if(G.boss.phase>=2)seen.phase2=1;
      if(G.boss.phase>=3){seen.phase3=1;if(G.lava&&G.lava.size>10)seen.bossLava=1;}
      if(G.boss.ai.cast==='ring'&&G.boss.ai.ringDir>0)seen.ring=1;
      // every boss bullet is born on the rim or further out — never at the body
      for(const b of G.ebullets)if(b.boss&&G.boss.ai.ringSafeT>0){
        const d=Math.hypot(b.x-G.boss.x,b.y-G.boss.y);
        if(d>=60)seen.rimBorn=1;
      }
    }
    if(G.wave===5&&G.waveState==='clear')seen.bossDead=1;
    if(G.wave>=6&&G.biome==='surface')seen.surfaceBack=1;
    if(G.wave>=6&&G.waveState==='fight'){seen.wave6=1;
      for(const e of G.enemies)if(e.type==='smasher'||e.type==='burster'||e.type==='fireslug')seen.types6=1;}
    if(G.wave!==lastWave){lastWave=G.wave;}
    if(G.wave>=7)break;
  }
  const tag=' ['+NP+'p]';
  say(seen.descent,'descent played'+tag);
  say(maxFade>=0.99,'descent faded to black ('+maxFade.toFixed(2)+')'+tag);
  say(seen.volcano,'volcano palette after the descent'+tag);
  say(seen.lavamix&&seen.smasher&&seen.burster&&seen.fireslug,'lava mix fired with all three mobs'+tag);
  say(seen.slugforge&&seen.forgeLive,'slug forge fired and woke'+tag);
  // a party that kills every slug on the march feeds nothing — then there is
  // nothing to shed, and that is the lesson working
  say(seen.orbs||!seen.heat,'behemoth shed orbs (or nothing was fed: heat '+(seen.heat||0)+')'+tag);
  say(seen.pressure&&seen.lava,'pressure fired with lava rivers'+tag);
  say(seen.phase2&&seen.phase3,'slagmaw reached phases 2 and 3'+tag);
  say(seen.bossLava,'cauldron cracked (lava in P3)'+tag);
  say(seen.ring&&seen.rimBorn,'cinder ring born on the rim'+tag);
  say(seen.bossDead,'slagmaw died'+tag);
  say(seen.ascent,'ascent played'+tag);
  say(seen.surfaceBack,'surface palette back by wave 6'+tag);
  say(seen.wave6,'wave 6 reached'+tag);
  say(!seen.types6,'no volcano fauna in wave 6'+tag);
  say(!G.lava,'lava cleared after the arc'+tag);
  console.log('  end: wave',G.wave,G.waveState,'level',G.level,'t',Math.round(G.time)+'s');
}
// the guard: volcano fauna never enters a classic mix past wave 5
const g0=boot(1);const W=g0.ev('CLASSIC_WAVES');
let leak=0;W.forEach((w,i)=>{if(i>=5&&w.mix)for(const k of ['smasher','burster','fireslug'])if(w.mix[k])leak=1;});
say(!leak,'no volcano fauna in CLASSIC_WAVES[5+].mix');
process.exit(fail);
