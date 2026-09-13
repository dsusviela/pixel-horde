// Spawn-direction fairness probe. Runs playground.html headless with a bot at
// the stick, logs every wave spawn's direction relative to the party's heading
// and to the player, and scores how the pressure is distributed.
//
//   node tools/probe-spawn.mjs [--bot runner|kiter|circle|all] [--variant base|<name>|all]
//                              [--secs 240] [--seed 41] [--np 1] [--json]
//
// Metrics (drip + front spawns during timed waves, heading = G.moveX/Y):
//   ahead/flank/behind  share of spawns within 45° of the heading / 45-135° / beyond
//                       (angles normalised by the camera half-size, so each screen edge is one quadrant)
//   torrent             share of 8s windows (>=6 spawns, party moving) with ahead >= 60%
//   wall                share of those windows where one of 4 heading-relative sectors owns >= 70%
//   stale               share of windows whose dominant sector equals the previous window's
//   streak              longest run of consecutive spawns from the same screen edge
//   edgeMax             mean over 15s windows of the busiest edge's share
//   trapped             share of sampled frames with >=4 mobs within 110 px and no
//                       escape arc >= 90° between them
//   gap                 mean widest empty arc (deg) around the player while >=4 mobs are near
//   hits/min            hurtPlayer + bossHit calls per minute (hp is reset every frame)
// Variants are spawn rules evaluated into the page over the landed ones (see VARIANTS).
import {boot} from './headless.mjs';
import fs from 'node:fs';

const args=process.argv.slice(2);const opt={};
for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);const v=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;opt[k]=v;}}
const SECS=+(opt.secs||240),SEED=+(opt.seed||41),NP=+(opt.np||1);
const bots=opt.bot&&opt.bot!=='all'?[opt.bot]:['runner','kiter','circle'];

export const VARIANTS={
  base:'', // whatever playground.html has landed (g4 since 2026-09-13)
  // ---- the rule before 2026-09-13: 60% of spawns from the edge the party walks toward
  legacy:`
spawnPoint=function(){
  const c=G.cam;
  const m=Math.max(40,c.w*0.08);
  const hx=G.moveX||0,hy=G.moveY||0,hl=Math.hypot(hx,hy);
  let lean=-1;
  if(hl>0.3)lean=Math.abs(hx)>Math.abs(hy)?(hx>0?1:0):(hy>0?3:2);
  for(let tries=0;tries<10;tries++){
    const side=(lean>=0&&Math.random()<0.6)?lean:(Math.random()*4)|0;
    let x,y;
    if(side===0){x=c.x-c.w/2-m;y=c.y+(Math.random()-0.5)*c.h;}
    else if(side===1){x=c.x+c.w/2+m;y=c.y+(Math.random()-0.5)*c.h;}
    else if(side===2){x=c.x+(Math.random()-0.5)*c.w;y=c.y-c.h/2-m;}
    else {x=c.x+(Math.random()-0.5)*c.w;y=c.y+c.h/2+m;}
    if(!solidAt(x,y))return {x,y};
  }
  return null;
};
frontSide=function(){
  const hx=G.moveX||0,hy=G.moveY||0;let side=-1;
  if(Math.hypot(hx,hy)>0.3&&Math.random()<0.6)side=Math.abs(hx)>Math.abs(hy)?(hx>0?1:0):(hy>0?3:2);
  if(side<0||side===G.lastSide){let t=0;do side=(Math.random()*4)|0;while(side===G.lastSide&&++t<8);}
  G.lastSide=side;return side;
};
`,
  // ---- v1 "pressure clock": the drip's angle comes from a phase that changes
  // every few seconds (AHEAD / FLANK / BEHIND / AROUND), never the same twice;
  // holding one heading for 5s forces a BEHIND phase; fronts follow the phase.
  clock:`
const SPAWN_PHASES=[['ahead',0.30],['flank',0.32],['behind',0.18],['around',0.20]];
function spawnClock(){
  const D=G.spawnDir||(G.spawnDir={phase:'around',until:0,last:'',h:0,holdA:0,holdT:0,flankSign:1});
  const hx=G.moveX||0,hy=G.moveY||0,hl=Math.hypot(hx,hy);
  if(hl>0.3)D.h=Math.atan2(hy,hx);
  // how long the party has held one heading (within 35°)
  if(hl>0.3){const d=Math.abs(((D.h-D.holdA+Math.PI*3)%(Math.PI*2))-Math.PI);if(d>0.6){D.holdA=D.h;D.holdT=G.time;}}
  else{D.holdA=D.h;D.holdT=G.time;}
  if(G.time>=D.until){
    let next;
    if(G.time-D.holdT>5&&D.last!=='behind'){next='behind';D.holdT=G.time;}
    else{
      let tot=0;const pool=SPAWN_PHASES.filter(p=>p[0]!==D.phase);for(const p of pool)tot+=p[1];
      let r=Math.random()*tot;next=pool[pool.length-1][0];
      for(const p of pool){r-=p[1];if(r<=0){next=p[0];break;}}
    }
    D.last=D.phase;D.phase=next;D.until=G.time+3+Math.random()*3;D.flankSign=Math.random()<0.5?-1:1;
  }
  return D;
}
// a world angle (from the camera centre) for one drip spawn
function spawnAngle(){
  const D=spawnClock(),h=D.h,g=()=>(Math.random()+Math.random()-1); // triangular noise in [-1,1]
  if(D.phase==='ahead')return h+g()*0.9;
  if(D.phase==='behind')return h+Math.PI+g()*1.0;
  if(D.phase==='flank'){D.flankSign=-D.flankSign;return h+D.flankSign*Math.PI/2+g()*0.7;}
  return Math.random()*Math.PI*2;
}
function edgePointAt(ang,extra){
  const c=G.cam,m=Math.max(40,c.w*0.08)+(extra||0),W=c.w/2+m,H=c.h/2+m;
  const cs=Math.cos(ang),sn=Math.sin(ang);
  const t=Math.min(W/Math.max(1e-6,Math.abs(cs)),H/Math.max(1e-6,Math.abs(sn)));
  return {x:c.x+cs*t,y:c.y+sn*t};
}
spawnPoint=function(){
  const a=spawnAngle();
  for(let tries=0;tries<8;tries++){
    const p=edgePointAt(a+(tries?g2()*0.5*tries:0));
    if(!solidAt(p.x,p.y))return p;
  }
  for(let tries=0;tries<6;tries++){const p=edgePointAt(Math.random()*Math.PI*2);if(!solidAt(p.x,p.y))return p;}
  return null;
};
function g2(){return Math.random()+Math.random()-1;}
// the front's edge: quantise the phase's angle to a side, never the last one
frontSide=function(){
  const a=spawnAngle();
  let side=Math.abs(Math.cos(a))>Math.abs(Math.sin(a))?(Math.cos(a)>0?1:0):(Math.sin(a)>0?3:2);
  if(side===G.lastSide){let t=0;do side=(Math.random()*4)|0;while(side===G.lastSide&&++t<8);}
  G.lastSide=side;return side;
};
`,
  // ---- v2 "weave": same clock, but AHEAD pressure comes from a front-quarter
  // (heading ± ~50°, the side alternating per phase) so walking on curves you
  // away instead of into a wall; BEHIND is rarer, and the held-heading pincer
  // needs 7s of one heading and 12s since the last one.
  weave:`
const SPAWN_PHASES=[['ahead',0.34],['flank',0.30],['behind',0.14],['around',0.22]];
function spawnClock(){
  const D=G.spawnDir||(G.spawnDir={phase:'around',until:0,last:'',h:0,holdA:0,holdT:0,sign:1,pincerT:-99});
  const hx=G.moveX||0,hy=G.moveY||0,hl=Math.hypot(hx,hy);
  if(hl>0.3)D.h=Math.atan2(hy,hx);
  if(hl>0.3){const d=Math.abs(((D.h-D.holdA+Math.PI*3)%(Math.PI*2))-Math.PI);if(d>0.6){D.holdA=D.h;D.holdT=G.time;}}
  else{D.holdA=D.h;D.holdT=G.time;}
  if(G.time>=D.until){
    let next;
    if(G.time-D.holdT>7&&G.time-D.pincerT>12&&D.phase!=='behind'){next='behind';D.pincerT=G.time;D.holdT=G.time;}
    else{
      let tot=0;const pool=SPAWN_PHASES.filter(p=>p[0]!==D.phase);for(const p of pool)tot+=p[1];
      let r=Math.random()*tot;next=pool[pool.length-1][0];
      for(const p of pool){r-=p[1];if(r<=0){next=p[0];break;}}
    }
    D.last=D.phase;D.phase=next;D.until=G.time+3+Math.random()*3;D.sign=Math.random()<0.5?-1:1;
  }
  return D;
}
function g2(){return Math.random()+Math.random()-1;}
function spawnAngle(){
  const D=spawnClock(),h=D.h;
  if(D.phase==='ahead')return h+D.sign*0.85+g2()*0.6;
  if(D.phase==='behind')return h+Math.PI+g2()*1.0;
  if(D.phase==='flank'){D.sign=-D.sign;return h+D.sign*Math.PI/2+g2()*0.7;}
  return Math.random()*Math.PI*2;
}
function edgePointAt(ang,extra){
  const c=G.cam,m=Math.max(40,c.w*0.08)+(extra||0),W=c.w/2+m,H=c.h/2+m;
  const cs=Math.cos(ang),sn=Math.sin(ang);
  const t=Math.min(W/Math.max(1e-6,Math.abs(cs)),H/Math.max(1e-6,Math.abs(sn)));
  return {x:c.x+cs*t,y:c.y+sn*t};
}
spawnPoint=function(){
  const a=spawnAngle();
  for(let tries=0;tries<8;tries++){const p=edgePointAt(a+(tries?g2()*0.5*tries:0));if(!solidAt(p.x,p.y))return p;}
  for(let tries=0;tries<6;tries++){const p=edgePointAt(Math.random()*Math.PI*2);if(!solidAt(p.x,p.y))return p;}
  return null;
};
frontSide=function(){
  const a=spawnAngle();
  let side=Math.abs(Math.cos(a))>Math.abs(Math.sin(a))?(Math.cos(a)>0?1:0):(Math.sin(a)>0?3:2);
  if(side===G.lastSide){let t=0;do side=(Math.random()*4)|0;while(side===G.lastSide&&++t<8);}
  G.lastSide=side;return side;
};
`,
};
// parameterised weave: P = phase weights, dur = [min,range] phase seconds, ahead = front-quarter
// offset (rad), halo = share of every phase's spawns that ignore the phase (uniform ring)
function weaveVariant(P){
  return `
const SPAWN_PHASES=${JSON.stringify(P.phases)},SPAWN_DUR=${JSON.stringify(P.dur)},SPAWN_AHEAD=${P.ahead},SPAWN_HALO=${P.halo},SPAWN_HOLD=${P.hold||7},SPAWN_PINCER_CD=${P.pincerCd||12},SPAWN_GAP=${P.gap||0};
function spawnClock(){
  const D=G.spawnDir||(G.spawnDir={phase:'around',until:0,last:'',h:0,holdA:0,holdT:0,sign:1,pincerT:-99});
  const hx=G.moveX||0,hy=G.moveY||0,hl=Math.hypot(hx,hy);
  if(hl>0.3)D.h=Math.atan2(hy,hx);
  if(hl>0.3){const d=Math.abs(((D.h-D.holdA+Math.PI*3)%(Math.PI*2))-Math.PI);if(d>0.6){D.holdA=D.h;D.holdT=G.time;}}
  else{D.holdA=D.h;D.holdT=G.time;}
  if(G.time>=D.until){
    let next;
    if(G.time-D.holdT>SPAWN_HOLD&&G.time-D.pincerT>SPAWN_PINCER_CD&&D.phase!=='behind'){next='behind';D.pincerT=G.time;D.holdT=G.time;}
    else{
      let tot=0;const pool=SPAWN_PHASES.filter(p=>p[0]!==D.phase);for(const p of pool)tot+=p[1];
      let r=Math.random()*tot;next=pool[pool.length-1][0];
      for(const p of pool){r-=p[1];if(r<=0){next=p[0];break;}}
    }
    D.last=D.phase;D.phase=next;D.until=G.time+SPAWN_DUR[0]+Math.random()*SPAWN_DUR[1];D.sign=Math.random()<0.5?-1:1;
  }
  return D;
}
function g2(){return Math.random()+Math.random()-1;}
function phaseAngle(D){
  const h=D.h;
  if(D.phase==='ahead')return h+D.sign*SPAWN_AHEAD+g2()*0.6;
  if(D.phase==='behind')return h+Math.PI+g2()*1.0;
  if(D.phase==='flank'){D.sign=-D.sign;return h+D.sign*Math.PI/2+g2()*0.7;}
  return Math.random()*Math.PI*2;
}
// how thick the horde already is in the 60° wedge around angle a (live mobs within 300 px of the party's centre)
function wedgeFill(a){
  let cx=0,cy=0,n=0;for(const p of G.players)if(!p.dead){cx+=p.x;cy+=p.y;n++;}
  if(!n)return 0;cx/=n;cy/=n;let f=0;
  for(const e of G.enemies){if(e.dead||e.boss||e.playAnchor)continue;const dx=e.x-cx,dy=e.y-cy,d2=dx*dx+dy*dy;if(d2>300*300)continue;
    const d=Math.abs(((Math.atan2(dy,dx)-a+Math.PI*3)%(Math.PI*2))-Math.PI);if(d<Math.PI/6)f+=1;}
  return f;
}
function spawnAngle(){
  const D=spawnClock();
  if(Math.random()<SPAWN_HALO)return Math.random()*Math.PI*2;
  if(!SPAWN_GAP)return phaseAngle(D);
  // the phase proposes, the gap disposes: of a few phase candidates and one
  // uniform one, spawn where the horde is thinnest (ties keep the phase)
  let best=phaseAngle(D),bf=wedgeFill(best);
  for(let i=1;i<SPAWN_GAP;i++){const a=i<SPAWN_GAP-1?phaseAngle(D):Math.random()*Math.PI*2,f=wedgeFill(a);if(f<bf){bf=f;best=a;}}
  return best;
}
function edgePointAt(ang,extra){
  const c=G.cam,m=Math.max(40,c.w*0.08)+(extra||0),W=c.w/2+m,H=c.h/2+m;
  const cs=Math.cos(ang),sn=Math.sin(ang);
  const t=Math.min(W/Math.max(1e-6,Math.abs(cs)),H/Math.max(1e-6,Math.abs(sn)));
  return {x:c.x+cs*t,y:c.y+sn*t};
}
spawnPoint=function(){
  const a=spawnAngle();
  for(let tries=0;tries<8;tries++){const p=edgePointAt(a+(tries?g2()*0.5*tries:0));if(!solidAt(p.x,p.y))return p;}
  for(let tries=0;tries<6;tries++){const p=edgePointAt(Math.random()*Math.PI*2);if(!solidAt(p.x,p.y))return p;}
  return null;
};
frontSide=function(){
  const a=spawnAngle();
  let side=Math.abs(Math.cos(a))>Math.abs(Math.sin(a))?(Math.cos(a)>0?1:0):(Math.sin(a)>0?3:2);
  if(side===G.lastSide){let t=0;do side=(Math.random()*4)|0;while(side===G.lastSide&&++t<8);}
  G.lastSide=side;return side;
};
`;}
// w2: shorter phases + a 30% halo; w3: same with a heavier ahead weight (difficulty kept nearer base)
VARIANTS.w2=weaveVariant({phases:[['ahead',0.34],['flank',0.28],['behind',0.14],['around',0.24]],dur:[2.5,2],ahead:0.6,halo:0.3});
VARIANTS.w3=weaveVariant({phases:[['ahead',0.44],['flank',0.26],['behind',0.12],['around',0.18]],dur:[2.5,2],ahead:0.6,halo:0.3});
VARIANTS.w4=weaveVariant({phases:[['ahead',0.44],['flank',0.26],['behind',0.12],['around',0.18]],dur:[2.5,2],ahead:0.45,halo:0.2});
// w5/w6: w4 with a quicker pincer (a held heading is answered sooner) — does kiting pay again?
VARIANTS.w5=weaveVariant({phases:[['ahead',0.44],['flank',0.26],['behind',0.12],['around',0.18]],dur:[2.5,2],ahead:0.45,halo:0.2,hold:5,pincerCd:9});
VARIANTS.w6=weaveVariant({phases:[['ahead',0.40],['flank',0.24],['behind',0.20],['around',0.16]],dur:[2.5,2],ahead:0.45,halo:0.2,hold:5,pincerCd:9});
// g4/g6: w4 with gap-seeking — 3 phase candidates + 1 uniform (g4), 5 + 1 (g6)
VARIANTS.g4=weaveVariant({phases:[['ahead',0.44],['flank',0.26],['behind',0.12],['around',0.18]],dur:[2.5,2],ahead:0.45,halo:0.2,gap:4});
VARIANTS.g6=weaveVariant({phases:[['ahead',0.44],['flank',0.26],['behind',0.12],['around',0.18]],dur:[2.5,2],ahead:0.45,halo:0.15,gap:6});
VARIANTS.g4b=weaveVariant({phases:[['ahead',0.40],['flank',0.24],['behind',0.20],['around',0.16]],dur:[2.5,2],ahead:0.45,halo:0.2,hold:5,pincerCd:9,gap:4});

const variants=opt.variant&&opt.variant!=='all'?[opt.variant]:Object.keys(VARIANTS);
const NSEEDS=+(opt.seeds||1);
const rows=[];
for(const variant of variants)for(const bot of bots){
  const rs=[];for(let s=0;s<NSEEDS;s++)rs.push(run(variant,bot,SEED+s));
  const avg={variant,bot};for(const k of Object.keys(rs[0]))if(typeof rs[0][k]==='number')avg[k]=rs.reduce((a,r)=>a+r[k],0)/rs.length;
  rows.push(avg);
}
if(opt.json)console.log(JSON.stringify(rows,null,1));
else{
  const hd=['variant','bot','spawns','ahead%','flank%','behind%','torrent%','wall%','stale%','streak','edgeMax%','trapped%','gap°','hits/min','waves'];
  const fmt=r=>[r.variant,r.bot,r.spawns.toFixed(0),pc(r.ahead),pc(r.flank),pc(r.behind),pc(r.torrent),pc(r.wall),pc(r.stale),r.streak.toFixed(0),pc(r.edgeMax),pc(r.trapped),r.gap.toFixed(0),r.hpm.toFixed(1),r.waves.toFixed(1)];
  const all=[hd,...rows.map(fmt)];const w=hd.map((_,i)=>Math.max(...all.map(r=>String(r[i]).length)));
  for(const r of all)console.log(r.map((c,i)=>String(c).padStart(w[i])).join('  '));
}
function pc(x){return (x*100).toFixed(0);}

function run(variant,bot,seed){
  const g=boot(seed,'playground.html');
  for(let i=0;i<NP;i++)g.addPad();
  const G=g.G;G.state='title';
  for(let i=0;i<NP;i++)g.ev('joinPlayer')(i,0);
  g.ev('startRun')('classic');
  if(VARIANTS[variant])g.ev(VARIANTS[variant]);
  else if(variant!=='base')throw new Error('unknown variant '+variant);
  // taps: tag drip/front spawn points, log every wave spawn, count hits
  g.ev(`
    window.__log=[];window.__src='';window.__hits=0;
    {const sp=spawnPoint,fp=frontPoint,se=spawnEnemy,hp=hurtPlayer,bh=bossHit;
     spawnPoint=function(){window.__src='drip';return sp.apply(this,arguments);};
     frontPoint=function(){window.__src='front';return fp.apply(this,arguments);};
     spawnEnemy=function(type,x,y,em){const e=se.call(this,type,x,y,em);
       if(G.waveState==='fight'&&window.__src){const p=G.players[0];window.__log.push({t:G.time,src:window.__src,x,y,px:p.x,py:p.y,cx:G.cam.x,cy:G.cam.y,cw:G.cam.w/2,ch:G.cam.h/2,hx:G.moveX||0,hy:G.moveY||0,wave:G.wave});}
       window.__src='';return e;};
     hurtPlayer=function(p,d){if(!(p.dead||p.invuln>0||p.hurtCd>0))window.__hits++;return hp.apply(this,arguments);};
     bossHit=function(p,pct){if(pct>0&&!(p.dead||p.invuln>0))window.__hits++;return bh.apply(this,arguments);};}
  `);
  const dt=1/60,steps=Math.round(SECS*60),updateCamera=g.ev('updateCamera');
  let nearFrames=0,trapped=0,gapSum=0,gapN=0;
  const rng=mulberry(seed*7+bot.length);
  let runA=rng()*Math.PI*2,runT=0;
  for(let f=0;f<steps;f++){
    for(const p of G.players){p.hp=p.maxhp;p.dmgMul=1.25;}
    if(G.state==='levelup'){
      for(const pick of G.levelupPicks)if(!pick.done)g.ev('takeOffer')(pick,true);
      if(G.levelupPicks.every(p=>p.done))g.ev('finishLevelup')();
      continue;
    }
    if(G.state!=='play')break;
    for(const p of G.players){
      const pad=g.pads[p.padIndex];if(!pad)continue;
      let ax=0,ay=0;
      if(bot==='runner'){
        // walks straight, turns 45-135° every 4-9s, reverses now and then
        runT-=dt;if(runT<=0){runT=4+rng()*5;runA+=(rng()<0.25?Math.PI:(rng()<0.5?1:-1)*(0.8+rng()*1.6));}
        ax=Math.cos(runA);ay=Math.sin(runA);
      }else if(bot==='kiter'){
        // away from the mass of nearby mobs; drifts when nothing is close
        let sx=0,sy=0,n=0;
        for(const e of G.enemies){if(e.dead||e.playAnchor)continue;const dx=e.x-p.x,dy=e.y-p.y,d2=dx*dx+dy*dy;if(d2<170*170){const w=1/Math.max(20,Math.sqrt(d2));sx+=dx*w;sy+=dy*w;n++;}}
        if(n){const l=Math.hypot(sx,sy)||1;ax=-sx/l;ay=-sy/l;}
        else{runT-=dt;if(runT<=0){runT=2+rng()*3;runA+=(rng()-0.5)*2;}ax=Math.cos(runA)*0.6;ay=Math.sin(runA)*0.6;}
      }else{
        const a=G.time*0.55+p.idx*Math.PI*2/Math.max(1,NP);
        const tx=G.cam.x+Math.cos(a)*150,ty=G.cam.y+Math.sin(a)*90,d=Math.hypot(tx-p.x,ty-p.y)||1;
        if(d>20){ax=(tx-p.x)/d;ay=(ty-p.y)/d;}
      }
      pad.axes[0]=ax;pad.axes[1]=ay;
    }
    g.step(dt);updateCamera(dt);
    if(f%6===0&&G.waveState==='fight'){
      const p=G.players[0];const sec=new Array(24).fill(0);let n=0;
      for(const e of G.enemies){if(e.dead||e.playAnchor||e.boss)continue;const dx=e.x-p.x,dy=e.y-p.y;if(dx*dx+dy*dy<110*110){sec[Math.floor(((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*24)]++;n++;}}
      if(n>=4){nearFrames++;let best=0,cur=0;for(let i=0;i<48;i++){if(sec[i%24]===0){cur++;best=Math.max(best,cur);}else cur=0;}
        const gap=Math.min(best,24)*15;gapSum+=gap;gapN++;if(gap<90)trapped++;}
    }
  }
  const log=g.ev('window.__log'),hits=g.ev('window.__hits');
  if(opt.dump){fs.writeFileSync(opt.dump.replace(/\.json$/,'')+'-'+variant+'-'+bot+'.json',JSON.stringify(log));}
  let ahead=0,flank=0,behind=0,moving=0;const streaks=[];let streak=0,lastSide=-1,maxStreak=0;
  const win8={},win15={};
  for(const s of log){
    const hl=Math.hypot(s.hx,s.hy);
    const ang=Math.atan2((s.y-s.py)/s.ch,(s.x-s.px)/s.cw); // screen-normalised: each edge is one 90° quadrant
    if(hl>0.3){moving++;const h=Math.atan2(s.hy,s.hx);const d=Math.abs(((ang-h+Math.PI*3)%(Math.PI*2))-Math.PI);
      const k=Math.floor(s.t/8);const w=win8[k]||(win8[k]={n:0,a:0,f:0,b:0,q:[0,0,0,0]});w.n++;
      w.q[Math.floor((((ang-h+Math.PI/4)%(Math.PI*2))+Math.PI*2)%(Math.PI*2)/(Math.PI/2))]++; // 4 sectors: ahead,left/right,behind,right/left
      if(d<Math.PI/4){ahead++;w.a++;}else if(d>Math.PI*3/4){behind++;w.b++;}else{flank++;w.f++;}}
    const rx=s.x-s.cx,ry=s.y-s.cy;const side=Math.abs(rx)>Math.abs(ry)?(rx>0?1:0):(ry>0?3:2);
    if(side===lastSide)streak++;else streak=1;lastSide=side;maxStreak=Math.max(maxStreak,streak);
    const k=Math.floor(s.t/15);const w=win15[k]||(win15[k]=[0,0,0,0,0]);w[side]++;w[4]++;
  }
  const w8=Object.keys(win8).map(Number).sort((a,b)=>a-b).map(k=>win8[k]).filter(w=>w.n>=6);const torrent=w8.length?w8.filter(w=>w.a/w.n>=0.6).length/w8.length:0;
  // wall: any one sector (ahead/flank/behind) owns >=70% of a window; switch/min: how often the dominant sector changes between consecutive windows
  const wall=w8.length?w8.filter(w=>Math.max(...w.q)/w.n>=0.7).length/w8.length:0;
  const dom=w=>w.q.indexOf(Math.max(...w.q));let sw=0;for(let i=1;i<w8.length;i++)if(dom(w8[i])!==dom(w8[i-1]))sw++;
  const stale=w8.length>1?1-sw/(w8.length-1):0; // share of windows whose dominant 4-sector is the same as the previous one
  // --timeline: one letter per 8s window, the dominant heading-relative sector (A ahead, L/R flanks, B behind; lower-case = under 60%)
  if(opt.timeline){const L='ALBR';console.log((variant+'/'+bot+'/'+seed).padEnd(18)+w8.map(w=>{const i=dom(w);const c=L[i];return w.q[i]/w.n>=0.6?c:c.toLowerCase();}).join(''));}
  const w15=Object.values(win15).filter(w=>w[4]>=8);const edgeMax=w15.length?w15.reduce((s,w)=>s+Math.max(w[0],w[1],w[2],w[3])/w[4],0)/w15.length:0;
  const mins=SECS/60;
  return {variant,bot,spawns:log.length,ahead:moving?ahead/moving:0,flank:moving?flank/moving:0,behind:moving?behind/moving:0,torrent,wall,stale,streak:maxStreak,edgeMax,trapped:nearFrames?trapped/nearFrames:0,gap:gapN?gapSum/gapN:0,hpm:hits/mins,waves:G.wave};
}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
