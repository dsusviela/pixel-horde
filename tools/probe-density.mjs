// On-camera object counts per wave (median / p90): enemies, bullets, particles,
// gems, damage numbers, ground fx — the legibility budget, 1p vs 4p.
//   node tools/probe-density.mjs [seed] [players] [dmgMul]
// On-screen object counts per wave, 1p vs 4p, immortal kiting bots
import {boot} from './headless.mjs';
const seed=+(process.argv[2]||7), NP=+(process.argv[3]||1), DMG=+(process.argv[4]||1);
const g=boot(seed);
for(let i=0;i<NP;i++)g.addPad();
g.G.state='title';
for(let i=0;i<NP;i++)g.ev('joinPlayer')(i,0);
g.ev('startRun')('classic');
const G=g.G, dt=1/60;
const S={}; // per wave: arrays of samples
const inCam=(o)=>Math.abs(o.x-G.cam.x)<G.cam.w/2&&Math.abs(o.y-G.cam.y)<G.cam.h/2;
let dpsAtWave={},lvAtWave={};
for(let f=0;f<60*700;f++){
  if(G.state==='levelup'){for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);if(G.levelupPicks.every(p=>p.done))g.ev('finishLevelup')();continue;}
  for(const p of G.players){
    const pad=g.pads[p.padIndex];if(!pad)continue;
    let best=null,bd=1e12;
    for(const e of G.enemies){if(e.dead||e.vulnMul===0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e;}}
    if(best){const d=Math.sqrt(bd)||1;const s=d<90?-1:(d>130?1:0);pad.axes[0]=s*(best.x-p.x)/d;pad.axes[1]=s*(best.y-p.y)/d;}
    else{pad.axes[0]=0;pad.axes[1]=0;}
    p.dmgMul=DMG;p.hp=p.maxhp;
  }
  g.step(dt);
  if(f%9===0)g.render();
  if(f%30===0&&(G.waveState==='fight'||G.waveState==='boss')){
    const w=G.wave;const a=S[w]=S[w]||[];
    const fx={};for(const x of G.fx){if(x.t>0)fx[x.kind]=(fx[x.kind]||0)+1;}
    a.push({en:G.enemies.filter(e=>!e.dead&&inCam(e)).length,pb:G.bullets.filter(inCam).length,eb:G.ebullets.filter(inCam).length,
      pt:G.particles.length,gm:G.gems.length,tx:G.texts.length,fxAll:G.fx.filter(x=>x.t>0).length,pool:fx.pool||0,ring:fx.ring||0,tel:(fx.tel||0)+(fx.safe||0)+(fx.mark||0),boom:fx.boom||0,
      cw:Math.round(G.cam.w),ch:Math.round(G.cam.h)});
    dpsAtWave[w]=G.waveDPS;lvAtWave[w]=G.level;
  }
  if(G.wave>=6)break;
}
const q=(arr,k,p)=>{const v=arr.map(s=>s[k]).sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor(v.length*p))]||0;};
console.log(`NP=${NP} dmg x${DMG}  (median / p90 per wave; on-camera counts)`);
console.log('wave lv  waveDPS  cam       enemies   pBullets  eBullets  particles  gems    dmgTexts  fx(pool/ring/tel/boom)');
for(const w of Object.keys(S)){const a=S[w];
  console.log(`${String(w).padStart(3)}  ${String(lvAtWave[w]).padStart(2)}  ${String(Math.round(dpsAtWave[w]||0)).padStart(6)}  ${a[0].cw}x${a[0].ch}  `+
   ['en','pb','eb','pt','gm','tx'].map(k=>`${String(q(a,k,0.5)).padStart(3)}/${String(q(a,k,0.9)).padEnd(4)}`).join('  ')+
   `  ${q(a,'pool',0.9)}/${q(a,'ring',0.9)}/${q(a,'tel',0.9)}/${q(a,'boom',0.9)}`);}
