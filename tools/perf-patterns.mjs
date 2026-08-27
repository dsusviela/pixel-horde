// Frame-cost probe: forces each CLASSIC wave with a god-kit bot and times
// update (g.step) and draw (g.render) per frame, so pattern waves can be
// compared against the plain opener and against the 16.7ms/60fps budget.
// Headless: render cost is the JS draw path only (canvas is stubbed), so
// read the numbers as relative load, not GPU truth.
//   node tools/perf-patterns.mjs [--frames 1800]
import {boot} from './headless.mjs';

const FRAMES=(()=>{const i=process.argv.indexOf('--frames');return i>0?+process.argv[i+1]:1800;})();
const WAVES=[1,2,3,4,6,7,8,9,11,12,13,14,16,17,18,19];
const dt=1/60;
const pct=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))];
const rows=[];
for(const w of WAVES){
  const g=boot(5);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
  const G=g.G,me=G.players[0];
  me.weapons={blaster:{lv:6,t:0,ang:0,evo:true}};
  me.dmgMul=40;me.school='destro';
  G.level=Math.min(30,w+4);
  G.wave=w-1;g.ev('nextWave')();
  const pat=g.ev('waveDef')(w).pattern||'-';
  const step=[],draw=[];
  let peakE=0,peakFx=0,peakPt=0;
  let stuck=0,last={x:0,y:0},detour=0,side=1,lock=null;
  for(let i=0;i<FRAMES;i++){
    if(G.state==='levelup'){
      for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);
      g.ev('finishLevelup')();continue;
    }
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
    if(lock&&(lock.dead||G.enemies.indexOf(lock)<0))lock=null;
    if(!lock){let bd=1e9;for(const e of G.enemies){if(e.dead)continue;const d=(e.x-me.x)**2+(e.y-me.y)**2;if(d<bd){bd=d;lock=e;}}}
    let dx=0,dy=0;
    if(lock){const tx=lock.x-me.x,ty=lock.y-me.y,l=Math.hypot(tx,ty)||1;if(l>22){dx=tx/l;dy=ty/l;}}
    if(Math.hypot(me.x-last.x,me.y-last.y)<0.35)stuck++;else stuck=Math.max(0,stuck-2);
    last={x:me.x,y:me.y};
    if(detour>0)detour--;else if(stuck>18){detour=90;side=-side;stuck=0;}
    if(detour>0){const nx=-dy*side,ny=dx*side;dx=nx;dy=ny;}
    g.pads[0].axes[0]=dx;g.pads[0].axes[1]=dy;
    let t0=performance.now();g.step(dt);let t1=performance.now();g.render();let t2=performance.now();
    step.push(t1-t0);draw.push(t2-t1);
    peakE=Math.max(peakE,G.enemies.length);
    peakFx=Math.max(peakFx,G.fx.length);
    peakPt=Math.max(peakPt,G.particles.length);
    if(G.wave>w||G.waveState==='inter')break; // wave done; keep the sample honest
  }
  step.sort((a,b)=>a-b);draw.sort((a,b)=>a-b);
  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
  rows.push({w,pat,frames:step.length,
    stepAvg:mean(step),stepP95:pct(step,0.95),stepMax:step[step.length-1],
    drawAvg:mean(draw),drawP95:pct(draw,0.95),
    peakE,peakFx,peakPt});
}
const f=(x,d=2)=>x.toFixed(d).padStart(6);
console.log('wave  pattern    frames  step avg/p95/max ms   draw avg/p95 ms   peak enemies/fx/particles');
for(const r of rows)
  console.log(String(r.w).padStart(4),r.pat.padEnd(10),String(r.frames).padStart(6),
    f(r.stepAvg),f(r.stepP95),f(r.stepMax),' ',f(r.drawAvg),f(r.drawP95),
    '   ',String(r.peakE).padStart(4),String(r.peakFx).padStart(4),String(r.peakPt).padStart(5));
const worst=rows.reduce((m,r)=>r.stepP95>m.stepP95?r:m);
console.log('\nworst p95 step: wave '+worst.w+' ['+worst.pat+'] '+worst.stepP95.toFixed(2)+'ms  (60fps budget: 16.7ms total)');
