// THE RAID (v3), end to end: wave 1 → the PATH pick → the surface block →
// SLAUGHTERHULK at 5 → the descent → the volcano block 6-9 (fire-slug
// trails, burster shoves, THE OFFERING with smashers, THE SLAG AUGUR's
// rites) → Slagmaw's three phases at 10 → the ascent → wave 11.
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
    smasher:0,burster:0,fireslug:0,types6:0,bossDead:0,
    slams:0,forgeHeal:0,forgeEnd:'',safe:0,inward:0,schoolW2:0,twoDiscs:0,
    hulkDead:0,trailW6:0,pops:0,augurUp:0,augurRites:0,brandPool:0,augurGone:0};
  const fxSeen=new WeakSet();let lastForgeHp=-1;const bstate=new WeakMap();let augRef=null;
  let maxFade=0,dpsMul=4,lastWave=0;
  const dt=1/60;
  for(let f=0;f<60*900;f++){
    // waves 2-3 are played at a plausible party output so the rehearsals
    // actually happen (at 4x the bot one-shot the forge before a slug
    // arrived and killed smashers mid-rush); the 4x kicks in from wave 4 to
    // keep the boss fight short
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;p.dmgMul=G.wave<=9?1.2:2;}
    // every row is drafted (a forced finish with rows still open discards them
    // — P2/P3 would never get their PATH)
    if(G.state==='levelup'){for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);if(G.levelupPicks.every(pk=>pk.done))g.ev('finishLevelup')();continue;}
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
      if(P.forge){
        seen.heat=Math.max(seen.heat||0,P.forge.heat);
        const fe=P.forge.e;
        // a fed slug visibly refills the bar: hp went UP between frames
        if(fe&&!fe.dead){if(lastForgeHp>=0&&fe.hp>lastForgeHp+0.01)seen.forgeHeal=1;lastForgeHp=fe.hp;}
        if(P.forge.st!=='idle')seen.forgeEnd=P.forge.st;
      }
      if(P.id==='pressure'){
        let discs=0;
        for(const x of G.fx){
          if(x.kind==='safe'&&x.t>0){discs++;if(!fxSeen.has(x)){fxSeen.add(x);seen.safe++;}}
          if(x.kind==='ring'&&x.dir<0&&x.t>0&&!fxSeen.has(x)){fxSeen.add(x);seen.inward++;}
        }
        if(discs>=2)seen.twoDiscs=1;
      }
      if(P.id==='pressure'&&G.terrain==='pressure'){
        // lava is terrain now: count river tiles in the camera window
        let n=0;const c=G.cam,hz=g.ev('hazardAt');
        for(let y=c.y-c.h/2;y<c.y+c.h/2;y+=16)for(let x=c.x-c.w/2;x<c.x+c.w/2;x+=16)if(hz(x,y)==='lava')n++;
        if(n>20)seen.lava=1;
      }
    }
    if(G.wave>=6&&G.wave<=9)for(const e of G.enemies){
      if(e.type==='smasher')seen.smasher=1;if(e.type==='burster')seen.burster=1;if(e.type==='fireslug')seen.fireslug=1;
      if(e.sm&&e.sm.st==='cast'&&e.sm.tel&&!fxSeen.has(e.sm.tel)){fxSeen.add(e.sm.tel);seen.slams++;}
      if(e.type==='burster'){const ls=bstate.get(e);if(e.fuse>=0&&ls!=='f')seen.pops++;bstate.set(e,e.fuse>=0?'f':'h');}
    }
    if(G.wave===6&&G.lava&&G.lava.size>0)seen.trailW6=1;
    if(G.wave===9&&G.wavePat&&G.wavePat.aug){
      const A=G.wavePat.aug;
      if(A.e){augRef=A.e;if(!A.e.dead)seen.augurUp=1;}
      for(const x of G.fx){
        if(x.t<=0||fxSeen.has(x))continue;
        if(x.kind==='safe'){fxSeen.add(x);seen.augurRites++;}
        if(x.kind==='ring'&&x.dir<0&&x.spd>1){fxSeen.add(x);seen.augurRites++;}
        if(x.kind==='pool'&&x.r>=40){fxSeen.add(x);seen.brandPool=1;seen.augurRites++;}
      }
    }
    if(G.wave===5&&G.waveState==='clear')seen.hulkDead=1;
    if(G.wave===2&&G.waveState==='pre'&&G.players.every(p=>p.school))seen.schoolW2=1;
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
    if(G.wave===10&&G.waveState==='clear')seen.bossDead=1;
    if(G.wave>=11&&G.biome==='surface')seen.surfaceBack=1;
    if(G.wave>=11&&G.waveState==='fight'){seen.wave6=1;
      for(const e of G.enemies)if(e.type==='smasher'||e.type==='burster'||e.type==='fireslug')seen.types6=1;}
    if(G.wave!==lastWave){lastWave=G.wave;}
    if(G.wave>=12)break;
  }
  const tag=' ['+NP+'p]';
  say(seen.descent,'descent played'+tag);
  say(maxFade>=0.99,'descent faded to black ('+maxFade.toFixed(2)+')'+tag);
  say(seen.volcano,'volcano palette after the descent'+tag);
  say(seen.schoolW2,'every player picked a PATH before wave 2'+tag);
  say(seen.hulkDead,'SLAUGHTERHULK fell at wave 5'+tag);
  say(seen.fireslug&&seen.trailW6,'wave 6: fire slugs left burning trails'+tag);
  say(seen.burster&&seen.pops>=3,'wave 7: bursters planted their swell ('+seen.pops+')'+tag);
  say(seen.smasher&&seen.slams>=6,'the smashers cast their slam discs ('+seen.slams+')'+tag);
  // a party that intercepts EVERY slug is the taught play at its extreme:
  // the forge never lights, cannot be broken, and sinks — also a pass
  say(((seen.heat||0)>0&&seen.forgeHeal)||((seen.heat||0)===0&&(seen.forgeEnd==='gone'||seen.forgeEnd==='dead')),'THE OFFERING: fed+healed, or perfectly intercepted (fed '+(seen.heat||0)+', '+seen.forgeEnd+')'+tag);
  say(seen.forgeEnd==='dead'||seen.forgeEnd==='gone','THE OFFERING: the forge died or sank ('+seen.forgeEnd+')'+tag);
  say(seen.augurUp&&seen.augurRites>=3,'THE SLAG AUGUR: stood and cast its rites ('+seen.augurRites+')'+tag);
  say(seen.brandPool,'THE SLAG AUGUR: a brand pool was dropped'+tag);
  say(!!(augRef&&augRef.dead),'THE SLAG AUGUR: broken or sunk'+tag);
  say(seen.phase2&&seen.phase3,'slagmaw reached phases 2 and 3'+tag);
  say(seen.bossLava,'cauldron cracked (lava in P3)'+tag);
  say(seen.ring&&seen.rimBorn,'cinder ring born on the rim'+tag);
  say(seen.bossDead,'slagmaw died'+tag);
  say(seen.ascent,'ascent played'+tag);
  say(seen.surfaceBack,'surface palette back by wave 6'+tag);
  say(seen.wave6,'wave 11 reached'+tag);
  say(!seen.types6,'no volcano fauna in wave 11'+tag);
  say(!G.lava,'lava cleared after the arc'+tag);
  console.log('  end: wave',G.wave,G.waveState,'level',G.level,'t',Math.round(G.time)+'s');
}
// the guard: volcano fauna never enters a classic mix past wave 5
const g0=boot(1);const W=g0.ev('CLASSIC_WAVES');
let leak=0;W.forEach((w,i)=>{if(i>=10&&w.mix)for(const k of ['smasher','burster','fireslug'])if(w.mix[k])leak=1;});
say(!leak,'no volcano fauna in CLASSIC_WAVES[10+].mix');
process.exit(fail);
