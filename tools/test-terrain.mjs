// Terrain waves: every pattern in the classic table must fire, tick, render
// and clean up without throwing. The bot walks at the nearest foe; the wave
// is force-started at the pattern's table index and run to its clear.
import {boot} from './headless.mjs';

let fail=0;
const say=(ok,m)=>{console.log((ok?'PASS ':'FAIL ')+m);if(!ok)fail=1;};
const g0=boot(1);
const WAVES=g0.ev('CLASSIC_WAVES');
for(const NP of [1,3]){
console.log('--- '+NP+' player(s)');
const seen=new Set();
for(let wi=0;wi<WAVES.length;wi++){
  const pat=WAVES[wi].pattern;
  if(!pat||seen.has(pat))continue;
  seen.add(pat);
  const g=boot(11+wi);
  g.G.state='title';
  for(let k=0;k<NP;k++){g.addPad();g.ev('joinPlayer')(k,k);}
  g.ev('startRun')('classic');
  const G=g.G;
  // jump to the wave before the pattern wave, then let the machine open it
  G.wave=wi;G.waveState='clear';G.waveT=2.4;G.level=Math.max(G.level,wi);
  G.waveDPS=90;
  let fired=false,maxFx=0,creep=0,voidT=0,rocks=0,bands=0,cleared=false;
  const dt=1/60;
  try{
    for(let i=0;i<60*140;i++){
      if(G.state==='levelup'){
        for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);
        g.ev('finishLevelup')();continue;
      }
      for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
      const me=G.players[0];
      let tgt=null,bd=1e9;
      for(const e of G.enemies){if(e.dead)continue;const d=(e.x-me.x)**2+(e.y-me.y)**2;if(d<bd){bd=d;tgt=e;}}
      if(tgt){const l=Math.hypot(tgt.x-me.x,tgt.y-me.y)||1;
        if(l>22){g.pads[0].axes[0]=(tgt.x-me.x)/l;g.pads[0].axes[1]=(tgt.y-me.y)/l;}
        else{g.pads[0].axes[0]=0;g.pads[0].axes[1]=0;}}
      g.step(dt);
      if(G.wavePat&&G.wavePat.id===pat&&G.wavePat.ei>0)fired=true;
      maxFx=Math.max(maxFx,G.fx.length);
      if(G.creep)creep=Math.max(creep,G.creep.size);
      if(G.wavePat&&G.wavePat.col)voidT=Math.max(voidT,G.wavePat.col.inset);
      if(G.wavePat&&G.wavePat.bands)bands=Math.max(bands,G.wavePat.bands.length);
      rocks=Math.max(rocks,G.tileOverride.size);
      if(i%11===0)g.render();
      if(G.wave===wi+1&&G.waveState==='clear'){cleared=true;}
      if(G.wave>wi+1)break;
    }
  }catch(err){say(false,pat+' THREW: '+err.message+'\n'+err.stack.split('\n').slice(0,3).join('\n'));continue;}
  say(fired,pat+': pattern fired (wave '+(wi+1)+')');
  say(cleared||G.wave>wi+1,pat+': wave cleared (state '+G.waveState+' wave '+G.wave+' enemies '+G.enemies.length+')');
  const extra=pat==='creep'?' creep tiles peak '+creep:pat==='collapse'?' inset peak '+voidT.toFixed(2):pat==='band'?' lanes '+bands:pat==='stonefall'?' rock tiles '+rocks:' fx peak '+maxFx;
  console.log('     '+pat+':'+extra+'  kills '+G.kills+'  level '+G.level);
  if(pat==='creep')say(creep>0,'creep: floor spread');
  if(pat==='collapse')say(voidT>=0.29,'collapse: screen shrank to the max');
  if(pat==='band')say(bands===NP,'band: one lane per player ('+bands+')');
  if(pat==='stonefall')say(rocks>0,'stonefall: boulders landed');
  // terrain must not leak into the next wave
  say(!G.creep&&!G.voidTiles,pat+': floor cleaned after the wave');
}}
console.log(fail?'\nTERRAIN: FAIL':'\nTERRAIN: ALL PASS');
process.exit(fail);
