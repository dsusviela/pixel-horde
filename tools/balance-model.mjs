// Balance model: measure what the game actually does per (wave × party size),
// then derive the tuning constants from targets instead of hand-feel.
//
//   node tools/balance-model.mjs progress [--players 1,2,3,4] [--seeds 1,3,7]
//                                [--mode classic|endless] [--json FILE]
//   node tools/balance-model.mjs dps    --json FILE     party DPS bench tables
//   node tools/balance-model.mjs solve  --json FILE     recommended constants
//   node tools/balance-model.mjs report [--players ...] TTK/pressure vs targets
//
// `progress` plays real seeded runs with a wall-following bot (one school per
// player, cycling destro/illusion/necro), logging at every boss: level, charm
// tally, per-player build, fight TTK and damage actually dealt. A threat probe
// wraps hurtPlayer/bossHit inside the vm — the 0.5s hurtCd gate is reproduced
// faithfully, the hp loss is not — so incoming pressure is measured while the
// bot stays deathless. All instrumentation lives here; index.html carries none.
//
// TARGETS — the only judgment numbers in the model. Argue with these, not
// with the derived constants.
export const TARGETS={
  classicTTK:[120,130,140,150],       // boss fight seconds, Slagmaw..Worldeater
  ttkBand:0.20,                       // report acceptance: ±20%
  // mob pressure P = incoming mob dmg per minute / party total max hp
  // ("party health bars per minute if nobody healed") — diagnostic only:
  // the probe bot face-tanks, so absolute P is an upper bound, not a truth
  pressure:{w0:2,p0:0.35,w1:18,p1:0.90},
  // the solved target: one CHASER hit as a fraction of the average player's
  // max hp. Flat relative bite is why late mobs feel toothless — a wave-18
  // mistake should cost twice the bar a wave-2 mistake does. Robust to bot
  // behavior: it prices the hits that land, not how often the bot gets hit.
  relBite:{w0:2,b0:0.095,w1:18,b1:0.16},
  endlessPressure:{t0:120,p0:0.40,t1:480,p1:1.00},
};

import fs from 'node:fs';
import {boot} from './headless.mjs';

const DT=1/60;
const SCHOOL_ORDER=['destro','illusion','necro'];

function args(){
  const a=process.argv.slice(2),o={cmd:a[0]||'report'};
  for(let i=1;i<a.length;i++){
    if(a[i]==='--players')o.players=a[++i].split(',').map(Number);
    else if(a[i]==='--seeds')o.seeds=a[++i].split(',').map(Number);
    else if(a[i]==='--mode')o.mode=a[++i];
    else if(a[i]==='--json')o.json=a[++i];
  }
  o.players=o.players||[1,2,3,4];
  o.seeds=o.seeds||[1,3,7];
  o.mode=o.mode||'classic';
  o.json=o.json||new URL(o.mode==='endless'?'./.balance-endless.json':'./.balance-run.json',
    import.meta.url).pathname;
  return o;
}
const pad=(v,n)=>String(v).padStart(n);
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const geomean=xs=>Math.exp(mean(xs.map(Math.log)));

// ---------------------------------------------------------------- progress --
function playRun(n,seed,mode){
  const g=boot(seed);
  for(let i=0;i<n;i++)g.addPad();
  g.G.state='title';
  const join=g.ev('joinPlayer');
  for(let i=0;i<n;i++)join(i,0);
  g.ev('startRun')(mode);
  const G=g.G;
  // threat probe: same guards and the same hurtCd throttle as the real
  // functions, but no hp is removed — the bot never dies, the measurement
  // still sees exactly the damage a real party would have eaten
  g.ev(`globalThis.__threat={mob:0,boss:0};
    hurtPlayer=function(p,dmg){
      if(p.dead||p.invuln>0||p.hurtCd>0)return;
      p.hurtCd=0.5;__threat.mob+=dmg;
    };
    bossHit=function(p,pct){
      if(pct<=0||p.dead||p.invuln>0)return;
      __threat.boss+=p.maxhp*pct*BOSS_DMG_MUL;
    };
    // mechanic competence by fiat: Geminox hides siphon pylons behind arena
    // pillars, and the wall-following pilot circles the pillar forever while
    // its spells auto-target the nearer boss — the drain then cancels party
    // dps EXACTLY and the fight freezes at full hp for as long as you let it
    // run. A real player breaks a pylon in ~6s of deliberate travel; model
    // that instead of the pathing skill the bot doesn't have.
    if(typeof spawnSiphonPylon==='function'){
      const __spawnPy=spawnSiphonPylon;
      spawnSiphonPylon=function(x,y){const e=__spawnPy(x,y);e.life=6;return e;};
    }
    // same fiat for Geminox CONVERGENCE: the wall-follower never stands on the
    // stack mark, so every miss heals 6% and the fight can out-heal bot dps
    // forever. A real party soaks most calls — model ~70% of the heals away.
    if(typeof bossHeal==='function'){
      const __bh=bossHeal;
      bossHeal=function(e,p){
        if(e&&e.def&&e.def.id==='geminox'&&p>=0.05)p*=0.3;
        __bh(e,p);
      };
    }`);
  const takeOffer=g.ev('takeOffer'),finishLevelup=g.ev('finishLevelup');
  const threat=g.ev('__threat');
  // draft like a competent player, not a coin flip — sel=1 of a shuffled pool
  // produced kit-quality swings (level-4 dps 22..380) that no deliberate
  // drafter has, and the boss solve needs the median kit to be a real median
  const PRIMARY={destro:'meteor',illusion:'arcmissile',necro:'decay'};
  const scoreOffer=(p,o)=>{
    if(o.kind==='evo')return 100;
    if(o.kind==='new')return o.id===PRIMARY[p.school]?90:60;
    if(o.kind==='up')return o.id==='blaster'?40:80;
    if(o.kind==='pas')return 70;
    if(o.kind==='gdmg')return 30;
    return 10;
  };
  const snapshotPlayers=()=>G.players.map(p=>({
    school:p.school,maxhp:p.maxhp,dmgMul:+p.dmgMul.toFixed(3),regen:+p.regen.toFixed(2),
    weapons:Object.fromEntries(Object.entries(p.weapons).map(([id,w])=>[id,w.evo?-w.lv:w.lv])),
    pas:{...p.pas}}));
  const waves=[],bosses=[];
  const peaks={fx:0,particles:0,bullets:0};
  let waveInfo=null,fight=null,lastKills=0,lastWave=0;
  const bossPrev=new Map();
  // per-player pilots: mirrored input cannot play split-duty mechanics (one
  // body breaks the pylon while the rest hold the boss), and clustered
  // parties under-use their own aoe coverage
  const pilots=Array.from({length:n},()=>({last:{x:0,y:0},stuck:0,detour:0,side:1,lock:null}));
  const capT=mode==='endless'?720:2600;
  const bucket=60; // endless "waves" are 60s buckets
  while(G.time<capT){
    if(G.state==='levelup'){
      let guard=0;
      while(G.levelupPicks&&G.levelupPicks.some(pk=>!pk.done)&&guard++<10){
        for(const pk of G.levelupPicks)if(!pk.done){
          if(pk.offers[0]&&pk.offers[0].kind==='school')pk.sel=pk.p.idx%3;
          else{
            let bi=0,bs=-1;
            pk.offers.forEach((o,i)=>{const s=scoreOffer(pk.p,o);if(s>bs){bs=s;bi=i;}});
            pk.sel=bi;
          }
          takeOffer(pk,false); // unforced: a school chain re-enters scoring
        }
      }
      finishLevelup();continue;
    }
    if(G.state==='slot'){g.step(DT);continue;} // lucky-chest reel: let it play out
    if(G.state!=='play')break; // victory / gameover
    const wNow=mode==='endless'?1+Math.floor(G.time/bucket):G.wave;
    if(wNow!==lastWave){
      if(waveInfo)closeWave(waveInfo);
      waveInfo={w:wNow,t0:G.time,mob0:threat.mob,boss0:threat.boss};
      lastWave=wNow;
    }
    // ---- bot ----
    for(const p of G.players){
      p.hp=p.maxhp; // acid bypasses the probe
      // a real player routes to gem piles; the bot chases the nearest enemy
      // and in dense multiplayer waves never has to cross the field for xp.
      // A generous magnet emulates deliberate collection for every party size.
      p.magnet=Math.max(p.magnet,100);
    }
    G.players.forEach((me,i)=>{
      const pl=pilots[i];
      let lock=pl.lock;
      if(lock&&(lock.dead||G.enemies.indexOf(lock)<0))lock=null;
      if(!lock){
        let bd=1e9;
        for(const e of G.enemies){
          if(e.dead)continue;
          const d=(e.x-me.x)**2+(e.y-me.y)**2;
          if(d<bd){bd=d;lock=e;}
        }
      }
      pl.lock=lock;
      let dx=0,dy=0,tx=0,ty=0,has=false;
      if(lock){tx=lock.x;ty=lock.y;has=true;}
      else{ // intermission: sweep charms, hearts and gems
        let bd=1e9;
        for(const q of G.pickups){if(q.dead)continue;const d=(q.x-me.x)**2+(q.y-me.y)**2;if(d<bd){bd=d;tx=q.x;ty=q.y;has=true;}}
        for(const q of G.gems){if(q.dead)continue;const d=(q.x-me.x)**2+(q.y-me.y)**2;if(d<bd){bd=d;tx=q.x;ty=q.y;has=true;}}
      }
      // hold range on a boss: walking into a 17px-radius body from 22px away
      // just bounces off its collision, trips the stuck-detour spiral and
      // turns the fight into a perpetual orbit where fixed-mark spells
      // (meteor) whiff a target in constant relative motion. Stand at 70px
      // and let the boss close — measured net dps went from ~10 to kit-level.
      const hold=(lock&&lock.boss)?70:22;
      let settled=false;
      if(has){
        const ax=tx-me.x,ay=ty-me.y,l=Math.hypot(ax,ay)||1;
        if(l>hold){dx=ax/l;dy=ay/l;}
        else settled=true;
      }
      if(!settled&&Math.hypot(me.x-pl.last.x,me.y-pl.last.y)<0.35)pl.stuck++;else pl.stuck=Math.max(0,pl.stuck-2);
      pl.last={x:me.x,y:me.y};
      if(pl.detour>0)pl.detour--;else if(pl.stuck>18){pl.detour=90;pl.side=-pl.side;pl.stuck=0;}
      if(pl.detour>0){const nx=-dy*pl.side,ny=dx*pl.side;dx=nx;dy=ny;}
      g.pads[i].axes[0]=dx;g.pads[i].axes[1]=dy;
    });
    g.step(DT);
    // ---- boss fight tracking ----
    const live=G.enemies.filter(e=>e.boss&&!e.dead);
    if(!fight&&live.length){
      fight={wave:G.wave,t0:G.time,level:G.level,hp0:live.reduce((s,e)=>s+e.maxhp,0),
        waveDPS:+(G.waveDPS||0).toFixed(1),
        charms:{...G.buffTally},players:snapshotPlayers(),dealt:0,vulnT:0};
      bossPrev.clear();for(const e of live)bossPrev.set(e,e.hp);
    }else if(fight){
      for(const e of live){
        const prev=bossPrev.has(e)?bossPrev.get(e):e.maxhp;
        if(e.hp<prev)fight.dealt+=prev-e.hp;
        bossPrev.set(e,e.hp);
      }
      if(live.some(e=>e.vulnMul!==0))fight.vulnT+=DT;
      if(!live.length&&G.bossKills>lastKills){
        fight.ttk=+(G.time-fight.t0).toFixed(1);
        fight.dps=+(fight.dealt/Math.max(1,fight.ttk)).toFixed(1);
        bosses.push(fight);fight=null;lastKills=G.bossKills;
      }else if(!live.length){fight=null;} // despawn without kill (shouldn't happen)
      else if(G.time-fight.t0>600)break;  // stalled fight: abort the run, keep partials
    }
    peaks.fx=Math.max(peaks.fx,G.fx.length);
    peaks.particles=Math.max(peaks.particles,G.particles.length);
    peaks.bullets=Math.max(peaks.bullets,G.bullets.length);
  }
  if(waveInfo)closeWave(waveInfo);
  function closeWave(wi){
    wi.dur=+(G.time-wi.t0).toFixed(1);
    wi.mob=+(threat.mob-wi.mob0).toFixed(0);
    wi.bossDmg=+(threat.boss-wi.boss0).toFixed(0);
    wi.level=G.level;
    wi.maxhpTotal=G.players.reduce((s,p)=>s+p.maxhp,0);
    delete wi.mob0;delete wi.boss0;
    if(wi.dur>1)waves.push(wi);
  }
  return {n,seed,mode,waves,bosses,peaks,endState:G.state,endWave:G.wave,
    endLevel:G.level,endTime:+G.time.toFixed(0),charms:{...G.buffTally}};
}

function progress(o,quiet){
  const runs=[];
  for(const n of o.players)for(const seed of o.seeds){
    const r=playRun(n,seed,o.mode);
    runs.push(r);
    if(!quiet)console.log(`run n=${n} seed=${seed}: ${r.endState} wave ${r.endWave} `+
      `level ${r.endLevel} t=${r.endTime}s bosses ${r.bosses.length} `+
      `peaks fx ${r.peaks.fx} particles ${r.peaks.particles}`);
  }
  const data={mode:o.mode,when:'run',runs};
  fs.writeFileSync(o.json,JSON.stringify(data));
  if(!quiet)console.log('wrote '+o.json);
  return data;
}

// --------------------------------------------------------------------- dps --
// Park a whole party in the dummy fixture with a given set of builds and
// count hp removed — the bench-schools method, generalized to N casters.
function benchParty(builds,{n=12,ring=44,hp=4e6,seed=7,layout='ring',gap=26,seconds=30}={}){
  const g=boot(seed);
  for(let i=0;i<builds.length;i++)g.addPad();
  g.G.state='title';
  const join=g.ev('joinPlayer');
  for(let i=0;i<builds.length;i++)join(i,0);
  g.ev('startRun')('classic');
  for(let i=0;i<6;i++)g.step(DT);
  const G=g.G;
  const anchor={x:G.players[0].x,y:G.players[0].y};
  builds.forEach((b,i)=>{
    const p=G.players[i];
    p.weapons={};p.pas={...(b.pas||{})};p.school=b.school||null;
    for(const [id,lv] of Object.entries(b.weapons))p.weapons[id]={lv:Math.abs(lv),t:0,ang:0,evo:lv<0};
    p.dmgMul=b.dmgMul||1;p.maxhp=b.maxhp||100;
  });
  G.bossKills=b0BossKills(builds);
  const face=0;
  const pos=(i,nn)=>layout==='column'
    ?[anchor.x+Math.cos(face)*(24+i*gap),anchor.y+Math.sin(face)*(24+i*gap)]
    :[anchor.x+Math.cos(i*Math.PI*2/nn)*ring,anchor.y+Math.sin(i*Math.PI*2/nn)*ring];
  const spawn=g.ev('spawnEnemy');
  const dummies=[],last=new Map();
  const place=i=>{
    const q=pos(i,n);
    const e=spawn('chaser',q[0],q[1]);
    e.hp=e.maxhp=hp;e.sp=0;e.dmg=0;e.xp=1;dummies[i]=e;last.set(e,hp);return e;
  };
  for(let i=0;i<n;i++)place(i);
  let dealt=0;
  for(let f=0;f<seconds/DT;f++){
    G.players.forEach((p,i)=>{
      p.hp=p.maxhp;p.invuln=1;
      p.x=anchor.x+(i%2?9:-9)*Math.ceil(i/2);p.y=anchor.y+(i>1?9:0);
      p.faceX=Math.cos(face);p.faceY=Math.sin(face);
    });
    G.xp=0;
    for(let i=0;i<n;i++){
      const e=dummies[i],q=pos(i,n);
      e.x=q[0];e.y=q[1];e.stunT=0;e.slow=1;
    }
    G.enemies=G.enemies.filter(e=>dummies.indexOf(e)>=0);
    G.ebullets.length=0;
    g.step(DT);
    for(let i=0;i<n;i++){
      const e=dummies[i];
      if(e.dead||e.hp<=0){dealt+=last.get(e);place(i);continue;}
      dealt+=last.get(e)-e.hp;last.set(e,e.hp);
    }
  }
  return dealt/seconds;
}
function b0BossKills(builds){
  // ultimates only cast when the run has a boss kill; if any build carries an
  // ult the checkpoint is past boss 1
  for(const b of builds)for(const id of Object.keys(b.weapons))
    if(['evocation','assassin','souls'].includes(id))return 1;
  return 1;
}

// Canonical "median player" pick order per school. One entry = one draft pick.
// 'evo:x' evolves x (requires max level, checked by the allocator).
const PICK_ORDER={
  destro:['meteor','meteor','meteor','ba','hh','meteor','ba','meteor','hh','meteor',
    'ba','cflame','cflame','cflame','hh','cflame','cflame','cflame','evo:meteor',
    'evocation','evocation','evocation','evocation','lavaray','lavaray','lavaray',
    'lavaray','lavaray','lavaray','cr','cr','cr','evo:cflame','blaster','blaster'],
  illusion:['arcmissile','arcmissile','arcmissile','mirror','mirror','arcmissile',
    'ka','arcmissile','mirror','arcmissile','ka','shocking','shocking','shocking',
    'mirror','shocking','shocking','shocking','evo:arcmissile','assassin','assassin',
    'assassin','assassin','eblast','eblast','eblast','eblast','eblast','eblast',
    'evo:shocking','blaster','blaster'],
  necro:['decay','decay','decay','leech','decay','leech','decay','decay','leech',
    'shadowb','shadowb','shadowb','shadowb','shadowb','shadowb','evo:decay',
    'souls','souls','souls','souls','plague','plague','plague','plague','plague',
    'diseases','diseases','diseases','evo:shadowb','blaster','blaster'],
};
const PAS_RANKS={ba:3,hh:3,cr:3,mirror:4,ka:2,leech:3};
const SPELL_MAX={evocation:4,assassin:4,souls:4};
function kitFor(school,picks,ultOk){
  const w={blaster:1},pas={};
  let spent=0;
  for(const item of PICK_ORDER[school]){
    if(spent>=picks)break;
    if(item.startsWith('evo:')){
      const id=item.slice(4),max=SPELL_MAX[id]||6;
      if(w[id]===max){w[id]=-max;spent++;}
      continue;
    }
    if(PAS_RANKS[item]){
      if((pas[item]||0)<PAS_RANKS[item]){pas[item]=(pas[item]||0)+1;spent++;}
      continue;
    }
    if(SPELL_MAX[item]===4&&!ultOk)continue;
    const max=SPELL_MAX[item]||6;
    if(!w[item]){w[item]=1;spent++;}
    else if(Math.abs(w[item])<max&&w[item]>0){w[item]++;spent++;}
  }
  return {school,weapons:w,pas};
}

function dps(o){
  const data=JSON.parse(fs.readFileSync(o.json,'utf8'));
  const byN=new Map();
  for(const r of data.runs){
    if(!byN.has(r.n))byN.set(r.n,[]);
    byN.get(r.n).push(r);
  }
  console.log('== recorded builds (real runs), single-dummy boss proxy ==');
  console.log('n  boss wave   level  charms  benchDPS(single)  benchDPS(swarm)');
  const out={recorded:[],kits:[]};
  for(const [n,runs] of byN){
    const nBosses=Math.max(...runs.map(r=>r.bosses.length));
    for(let bi=0;bi<nBosses;bi++){
      const fights=runs.map(r=>r.bosses[bi]).filter(Boolean);
      if(!fights.length)continue;
      const singles=[],swarms=[];
      for(const f of fights){
        singles.push(benchParty(f.players,{n:1,ring:70}));
        swarms.push(benchParty(f.players));
      }
      const charmsN=mean(fights.map(f=>Object.values(f.charms).reduce((s,x)=>s+x,0)));
      const row={n,boss:bi,wave:fights[0].wave,level:+mean(fights.map(f=>f.level)).toFixed(1),
        charms:+charmsN.toFixed(1),single:+mean(singles).toFixed(0),swarm:+mean(swarms).toFixed(0)};
      out.recorded.push(row);
      console.log(pad(n,1),pad(row.boss+1,5),pad(row.wave,5),pad(row.level,7),
        pad(row.charms,7),pad(row.single,17),pad(row.swarm,16));
    }
  }
  console.log('\n== canonical kits at the recorded pick budget, single fixture ==');
  console.log('n  boss  destro  illusion  necro  mixed');
  for(const [n,runs] of byN){
    const nBosses=Math.max(...runs.map(r=>r.bosses.length));
    for(let bi=0;bi<nBosses;bi++){
      const fights=runs.map(r=>r.bosses[bi]).filter(Boolean);
      if(!fights.length)continue;
      const level=Math.round(mean(fights.map(f=>f.level)));
      const dmgMul=mean(fights.flatMap(f=>f.players.map(p=>p.dmgMul)));
      const maxhp=mean(fights.flatMap(f=>f.players.map(p=>p.maxhp)));
      const picks=Math.max(1,level-1),ultOk=bi>0;
      const mk=school=>({...kitFor(school,picks,ultOk),dmgMul,maxhp});
      const row={n,boss:bi,picks};
      for(const comp of ['destro','illusion','necro','mixed']){
        const builds=Array.from({length:n},(_,i)=>
          mk(comp==='mixed'?SCHOOL_ORDER[i%3]:comp));
        row[comp]=+benchParty(builds,{n:1,ring:70}).toFixed(0);
      }
      out.kits.push(row);
      console.log(pad(n,1),pad(bi+1,5),pad(row.destro,7),pad(row.illusion,9),
        pad(row.necro,6),pad(row.mixed,6));
    }
  }
  data.dps=out;
  fs.writeFileSync(o.json,JSON.stringify(data));
  return out;
}

// ------------------------------------------------------------------- solve --
function pressureTarget(w){
  const {w0,p0,w1,p1}=TARGETS.pressure;
  return p0+(p1-p0)*Math.min(1,Math.max(0,(w-w0)/(w1-w0)));
}
function solve(o){
  const data=JSON.parse(fs.readFileSync(o.json,'utf8'));
  const runs=data.runs.filter(r=>r.mode!=='endless');
  // --- boss hp ---
  console.log('== measured boss fights (current tuning) ==');
  console.log('n  boss  wave  level  TTK(s)  hp@spawn  dealtDPS');
  const rows=[];
  for(const r of runs)r.bosses.forEach((f,bi)=>{
    rows.push({n:r.n,boss:bi,wave:f.wave,level:f.level,ttk:f.ttk,hp:f.hp0,dps:f.dps});
  });
  for(const x of rows.slice().sort((a,b)=>a.n-b.n||a.boss-b.boss))
    console.log(pad(x.n,1),pad(x.boss+1,5),pad(x.wave,5),pad(x.level,6),
      pad(x.ttk,7),pad(Math.round(x.hp),9),pad(x.dps,9));
  // HP_target = dealtDPS × targetTTK, fitted to d.hp × (4n-1)/3 × (1+slope·OL)
  const partyMul=n=>(4*n-1)/3;
  const OL=x=>Math.max(0,x.level-(2+x.wave));
  let best=null;
  for(let slope=0;slope<=0.12+1e-9;slope+=0.01){
    const dhp=[],res=[];
    for(let b=0;b<4;b++){
      const xs=rows.filter(x=>x.boss===b);
      if(!xs.length){dhp.push(null);continue;}
      const est=xs.map(x=>x.dps*TARGETS.classicTTK[b]/(partyMul(x.n)*(1+slope*OL(x))));
      const d=geomean(est);dhp.push(d);
      for(const x of xs)res.push(Math.log(x.dps*TARGETS.classicTTK[b]/(partyMul(x.n)*(1+slope*OL(x))*d))**2);
    }
    const r2=mean(res);
    if(!best||r2<best.r2)best={slope:+slope.toFixed(2),dhp,r2};
  }
  console.log('\n== recommended constants ==');
  console.log('CLASSIC_TTK targets:',TARGETS.classicTTK.join('/'));
  console.log('d.hp (Slagmaw/Geminox/Pyraxis/Worldeater):',
    best.dhp.map(x=>x?Math.round(x/100)*100:'?').join(' / '));
  console.log('over-level slope:',best.slope,' (formula 1+slope*max(0,level-(2+wave)); current 0.06)');
  // residuals by n at the chosen slope — does (4n-1)/3 still fit?
  for(let n2=1;n2<=4;n2++){
    const xs=rows.filter(x=>x.n===n2);
    if(!xs.length)continue;
    const r=mean(xs.map(x=>x.dps*TARGETS.classicTTK[x.boss]/
      (partyMul(x.n)*(1+best.slope*OL(x))*best.dhp[x.boss])));
    console.log(`  party-mul residual n=${n2}: ${r.toFixed(2)} (1.00 = (4n-1)/3 exact)`);
  }
  // CLASSIC_GROWTH: dps ratio between consecutive bosses, per gap — the
  // boss1→2 jump (five farm waves + the boss-kill level burst + the ult
  // unlock) is far larger than boss3→4 and one scalar would misprice both
  for(let gap=1;gap<4;gap++){
    const ratios=[];
    for(const r of runs)if(r.bosses.length>gap)
      ratios.push(r.bosses[gap].dps/r.bosses[gap-1].dps);
    if(ratios.length)console.log(`CLASSIC_GROWTH[boss${gap}→${gap+1}] geomean `+
      geomean(ratios).toFixed(2)+'  spread '+ratios.map(x=>+x.toFixed(2)).join(' '));
  }
  // --- mob pressure ---
  console.log('\n== mob pressure (classic, non-boss waves) ==');
  console.log('wave  P measured  P target  needed dmg ×');
  const fit=[];
  const byWave=new Map();
  for(const r of runs)for(const w of r.waves){
    // boss contact and boss bullets land through hurtPlayer too — a boss
    // wave's "mob" channel is really the boss and must not steer the mob fit
    if(w.w%5===0)continue;
    if(!byWave.has(w.w))byWave.set(w.w,[]);
    byWave.get(w.w).push(w);
  }
  for(const [wv,ws] of [...byWave].sort((a,b)=>a[0]-b[0])){
    const P=mean(ws.map(w=>(w.mob/Math.max(1,w.dur))*60/w.maxhpTotal));
    const Pt=pressureTarget(wv);
    if(P>0.001){
      const m=Pt/P;
      fit.push({w:wv,y:(1+0.09*wv)*m});
      console.log(pad(wv,4),pad(P.toFixed(2),11),pad(Pt.toFixed(2),9),pad(m.toFixed(2),13));
    }
  }
  // relative-bite solve: dmgScale(w) must equal bite(w)·avgMaxhp(w)/chaserBase.
  // Fit 1 + c1·w + c2·w² by least squares on the needed curve.
  const {w0,b0,w1,b1}=TARGETS.relBite;
  const need=[];
  console.log('\nwave  avg maxhp  dmgScale now  dmgScale needed (relBite target)');
  for(const [wv,ws] of [...byWave].sort((a,b)=>a[0]-b[0])){
    const avgMax=mean(ws.map(w=>w.maxhpTotal))/mean(ws.map(w=>runs.find(r=>r.waves.includes(w)).n));
    const bite=b0+(b1-b0)*Math.min(1,Math.max(0,(wv-w0)/(w1-w0)));
    const ds=bite*avgMax/8; // 8 = chaser base dmg
    need.push({w:wv,y:ds});
    console.log(pad(wv,4),pad(avgMax.toFixed(0),9),pad((1+0.09*wv).toFixed(2),13),pad(ds.toFixed(2),12));
  }
  if(need.length>3){
    // least squares for y-1 = c1·w + c2·w² (through (0,1))
    let s11=0,s12=0,s22=0,t1=0,t2=0;
    for(const f of need){const z=f.y-1;s11+=f.w*f.w;s12+=f.w**3;s22+=f.w**4;t1+=f.w*z;t2+=f.w*f.w*z;}
    const det=s11*s22-s12*s12;
    const c1=(t1*s22-t2*s12)/det,c2=(t2*s11-t1*s12)/det;
    console.log('campaign dmgScale fit: 1 + '+c1.toFixed(3)+'·w + '+c2.toFixed(4)+'·w²  (current 1+0.09·w)');
  }
  // --- endless ---
  const efile=new URL('./.balance-endless.json',import.meta.url).pathname;
  const eruns=(fs.existsSync(efile)?JSON.parse(fs.readFileSync(efile,'utf8')).runs:[])
    .concat(data.runs.filter(r=>r.mode==='endless'));
  if(eruns.length){
    console.log('\n== endless pressure (60s buckets) ==');
    console.log('t(min)  P measured  P target  needed dmg ×');
    const efit=[];
    const byB=new Map();
    for(const r of eruns)for(const w of r.waves){
      if(!byB.has(w.w))byB.set(w.w,[]);
      byB.get(w.w).push(w);
    }
    const {t0,p0,t1,p1}=TARGETS.endlessPressure;
    for(const [bk,ws] of [...byB].sort((a,b)=>a[0]-b[0])){
      const tMid=(bk-0.5)*60;
      const P=mean(ws.map(w=>(w.mob/Math.max(1,w.dur))*60/w.maxhpTotal));
      const Pt=p0+(p1-p0)*Math.min(1,Math.max(0,(tMid-t0)/(t1-t0)));
      if(P>0.001){
        efit.push({t:tMid,y:(1+0.0035*tMid)*(Pt/P)});
        console.log(pad((tMid/60).toFixed(1),6),pad(P.toFixed(2),11),pad(Pt.toFixed(2),9),
          pad((Pt/P).toFixed(2),13));
      }
    }
    // The endless buckets mix boss face-tank contact into the mob channel
    // (no wave separation exists there), so a regression over them is not
    // trustworthy — the table above is a diagnostic. The visible trend is P
    // sagging as golden-boon maxhp outruns 1+t·0.0035; recommendation is a
    // moderate slope raise, verified by re-running this probe.
    console.log('endless recommendation: dmgScale slope 0.0035 → 0.005, boss dmg 20/12 → 24/15');
  }
}

// ------------------------------------------------------------------ report --
function report(o){
  console.log('acceptance run — targets: TTK '+TARGETS.classicTTK.join('/')+
    's ±'+TARGETS.ttkBand*100+'%');
  const data=progress({...o,json:o.json+'.report'},true);
  console.log('\nn  boss  wave  TTK(s)  target  band        verdict');
  let fail=0;
  for(const r of data.runs)r.bosses.forEach((f,bi)=>{
    const tgt=TARGETS.classicTTK[Math.min(bi,3)];
    const lo=tgt*(1-TARGETS.ttkBand),hi=tgt*(1+TARGETS.ttkBand);
    const ok=f.ttk>=lo&&f.ttk<=hi;
    if(!ok)fail++;
    console.log(pad(r.n,1),pad(bi+1,5),pad(f.wave,5),pad(f.ttk,7),pad(tgt,7),
      pad(lo.toFixed(0)+'-'+hi.toFixed(0),11),ok?'  ok':'  OUT '+(f.ttk<lo?'(fast)':'(slow)'));
  });
  console.log('\nwave  P measured  P target');
  const byWave=new Map();
  for(const r of data.runs)for(const w of r.waves){
    if(!byWave.has(w.w))byWave.set(w.w,[]);
    byWave.get(w.w).push(w);
  }
  for(const [wv,ws] of [...byWave].sort((a,b)=>a[0]-b[0])){
    const P=mean(ws.map(w=>(w.mob/Math.max(1,w.dur))*60/w.maxhpTotal));
    console.log(pad(wv,4),pad(P.toFixed(2),11),pad(pressureTarget(wv).toFixed(2),9));
  }
  const pk=data.runs.reduce((m,r)=>({fx:Math.max(m.fx,r.peaks.fx),
    particles:Math.max(m.particles,r.peaks.particles),
    bullets:Math.max(m.bullets,r.peaks.bullets)}),{fx:0,particles:0,bullets:0});
  console.log('\npeaks: fx '+pk.fx+'  particles '+pk.particles+'  bullets '+pk.bullets);
  console.log(fail?'TTK: '+fail+' fight(s) OUT of band':'TTK: all fights in band');
}

const o=args();
if(o.cmd==='progress')progress(o);
else if(o.cmd==='dps')dps(o);
else if(o.cmd==='solve')solve(o);
else if(o.cmd==='report')report(o);
else console.log('usage: balance-model.mjs progress|dps|solve|report [--players 1,2] [--seeds 1,3,7] [--mode classic|endless] [--json FILE]');
