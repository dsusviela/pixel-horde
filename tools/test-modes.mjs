// Smoke test: CLASSIC and ENDLESS must still run (and render) after the BOSS
// RUSH work. Five simulated minutes each, with the same wall-following bot the
// rush test uses, then a pass over every UI screen in both languages.
import {boot} from './headless.mjs';

let fail=0;
for(const mode of ['classic','endless']){
  const g=boot(7);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')(mode);
  const dt=1/60;let t=0,stuck=0,last={x:0,y:0},detour=0,side=1,lock=null;
  try{
    for(let i=0;i<60*300;i++){
      const G=g.G;
      if(G.state==='levelup'){
        for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true); // chain-aware: a school card resolves to a starter spell
        g.ev('finishLevelup')();continue;
      }
      for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
      const me=G.players[0];
      if(lock&&(lock.dead||G.enemies.indexOf(lock)<0))lock=null;
      if(!lock){let bd=1e9;for(const e of G.enemies){if(e.dead)continue;const d=(e.x-me.x)**2+(e.y-me.y)**2;if(d<bd){bd=d;lock=e;}}}
      let dx=0,dy=0;
      if(lock){const tx=lock.x-me.x,ty=lock.y-me.y,l=Math.hypot(tx,ty)||1;if(l>22){dx=tx/l;dy=ty/l;}}
      if(Math.hypot(me.x-last.x,me.y-last.y)<0.35)stuck++;else stuck=Math.max(0,stuck-2);
      last={x:me.x,y:me.y};
      if(detour>0)detour--;else if(stuck>18){detour=90;side=-side;stuck=0;}
      if(detour>0){const nx=-dy*side,ny=dx*side;dx=nx;dy=ny;}
      g.pads[0].axes[0]=dx;g.pads[0].axes[1]=dy;
      g.step(dt);
      if(i%13===0)g.render();
      t+=dt;
    }
  }catch(err){console.log(mode,'THREW',err.message);fail=1;continue;}
  const G=g.G;
  const ok=G.state==='play'&&G.kills>0;
  console.log((ok?'PASS ':'FAIL ')+mode+' -> state '+G.state+'  wave '+G.wave+'  level '+G.level+'  kills '+G.kills);
  if(!ok)fail=1;
}

// every screen, every mode, both languages
const g=boot(3);
g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);
for(const lang of ['en','es']){
  g.ev('setLang')(lang);
  try{
    const G=g.G;
    G.state='title';g.render();
    G.state='modesel';for(let i=0;i<3;i++){G.modeSel=i;g.render();}
    g.ev('startRun')('rush');
    G.state='paused';g.render();
    G.bossTimes=Array.from({length:24},(_,i)=>40+i*45);G.bossKills=24;G.overSince=1400;
    G.state='victory';g.render();
    G.state='gameover';g.render();
    G.state='play';g.render();
    console.log('PASS screens render ('+lang+')');
  }catch(err){console.log('FAIL screens ('+lang+') '+err.message);fail=1;}
}
process.exit(fail);
