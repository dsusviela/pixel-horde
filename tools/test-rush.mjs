// Drives a full BOSS RUSH run headlessly: the opening draft, every boss, the
// relic drops and the victory screen. Players are immortal here — the point is
// to prove the mode's state machine and the signature spells run, not to
// measure difficulty.
import {boot} from './headless.mjs';

const seed=+(process.argv[2]||1);
const g=boot(seed);
console.log('seed',seed);
g.addPad();
g.G.state='title';
g.ev('joinPlayer')(0,0);
g.ev('startRun')('rush');

let t=0,levelups=0,seenRelics=[],lastWave=0,stuck=0,lastPos={x:0,y:0},detour=0,side=1,lock=null;
const dt=1/60;
for(let i=0;i<60*60*200&&g.G.state!=='victory'&&g.G.state!=='gameover';i++){
  const G=g.G;
  // auto-confirm level-up picks and keep the party alive
  if(G.state==='levelup'){
    for(const pick of G.levelupPicks)if(!pick.done){pick.done=true;g.ev('applyOffer')(pick.p,pick.offers[pick.sel]);}
    g.ev('finishLevelup')();
    levelups++;
    continue;
  }
  for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
  // the bot walks at whatever is closest — several fights (Geminox's healing
  // pylons) never end if nobody moves off the spawn point
  const me=G.players[0];
  // adds that punish being ignored (Geminox's siphon pylons, Slagmaw's
  // offerings) come first, and the bot stays locked on one until it dies —
  // flip-flopping between targets kills nothing at all
  if(lock&&(lock.dead||G.enemies.indexOf(lock)<0))lock=null;
  if(!lock||!(lock.type==='pylon'||lock.offering)){
    const prio=G.enemies.filter(e=>!e.dead&&(e.type==='pylon'||e.offering));
    let bd2=1e9;
    for(const e of (prio.length?prio:G.enemies)){
      if(e.dead)continue;
      const d=(e.x-me.x)**2+(e.y-me.y)**2;
      if(d<bd2){bd2=d;lock=e;}
    }
  }
  // mechanics that matter even to an immortal bot: an unsoaked CONVERGENCE
  // heals the twins, and sparks left on the floor heal the magus — walk to
  // them or the fight never ends
  let goal=null;
  for(const f of G.fx)if(f.kind==='stack'){goal=f;break;}
  if(!goal){
    let sd=1e9;
    for(const pk of G.pickups)if(pk.type==='spark'){
      const d=(pk.x-me.x)**2+(pk.y-me.y)**2;
      if(d<sd){sd=d;goal=pk;}
    }
  }
  let dx=0,dy=0,bd=1e9;
  if(goal){
    const tx=goal.x-me.x,ty=goal.y-me.y;
    const len=Math.hypot(tx,ty)||1;
    if(tx*tx+ty*ty>8*8){dx=tx/len;dy=ty/len;}
  }else if(lock){
    const tx=lock.x-me.x,ty=lock.y-me.y;
    bd=tx*tx+ty*ty;
    const len=Math.hypot(tx,ty)||1;
    if(bd>22*22){dx=tx/len;dy=ty/len;}
  }
  // there is no pathfinding in the game, so a bot that walks straight at its
  // target wedges on a pillar forever. When it stops making progress it
  // commits to a tangent for a beat — a crude wall-follow, enough to round a
  // pillar the way a player would.
  if(Math.hypot(me.x-lastPos.x,me.y-lastPos.y)<0.35)stuck++;else stuck=Math.max(0,stuck-2);
  lastPos={x:me.x,y:me.y};
  if(detour>0)detour--;
  else if(stuck>18){detour=90;side=-side;stuck=0;}
  if(detour>0){const nx=-dy*side,ny=dx*side;dx=nx;dy=ny;}
  g.pads[0].axes[0]=dx;
  g.pads[0].axes[1]=dy;
  g.step(dt);
  if(i%17===0)g.render(); // the HUD/banner paths must survive every wave state too
  t+=dt;
  if(G.wave!==lastWave){lastWave=G.wave;console.log(`  t=${t.toFixed(0)}s  -> boss ${G.wave}  level ${G.level}  relics [${G.relics}]`);}
  if(G.relics.length!==seenRelics.length){seenRelics=[...G.relics];console.log(`  t=${t.toFixed(0)}s  RELIC: ${seenRelics[seenRelics.length-1]}`);}
}
const G=g.G;
console.log('\nstate      ',G.state);
console.log('sim time   ',t.toFixed(1)+'s');
console.log('bosses     ',G.bossKills+'/'+g.ev('waveCount()'));
console.log('level      ',G.level,' level-ups:',levelups);
console.log('relics     ',G.relics.join(', '));
console.log('p1 weapons ',Object.entries(g.G.players[0].weapons).map(([k,w])=>k+':'+w.lv+(w.evo?'*':'')).join(' '));
console.log('p1 relics  ',Object.keys(g.G.players[0].relics).join(', '));
const n=g.ev('waveCount()');
console.log('boss times ',G.bossTimes.map((t,i)=>g.ev('RUSH_ROSTER')[i].name+' '+Math.round(t)+'s').join('\n            '));
// only the four capstone raid bosses leave their signature behind
const wantRelics=['slagmaw','geminox','pyraxis','worldeater'];
const ok=G.state==='victory'&&G.bossKills===n&&
  wantRelics.every(r=>G.relics.indexOf(r)>=0)&&G.relics.length===wantRelics.length;
console.log(ok?'\nPASS':'\nFAIL');
process.exit(ok?0:1);
