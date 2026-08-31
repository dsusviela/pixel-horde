// The hostage clock: solo drafts never force; the school chain re-arms it;
// a co-op straggler is still forced once someone else has picked.
import {boot} from './headless.mjs';
const say=(ok,m)=>console.log((ok?'ok   ':'FAIL ')+m);
const dt=1/60;
// --- solo: sit on the PATH screen for 30s, then pick; chained row must survive ---
{
  const g=boot(7);g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
  const G=g.G;
  for(let f=0;f<60*120&&G.state!=='levelup';f++){
    const p=G.players[0],pad=g.pads[0];let best=null,bd=1e12;
    for(const e of G.enemies){if(e.dead||e.vulnMul===0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e;}}
    if(best){const d=Math.sqrt(bd)||1;pad.axes[0]=(best.x-p.x)/d;pad.axes[1]=(best.y-p.y)/d;}
    p.hp=p.maxhp;g.step(dt);
  }
  say(G.state==='levelup'&&G.levelupPicks[0].offers[0].kind==='school','solo reached the PATH screen');
  for(let f=0;f<60*30;f++)g.step(dt); // 30 idle seconds, no input
  say(G.state==='levelup'&&!G.levelupPicks[0].done&&G.players[0].school==null,'solo: 30s idle and the PATH is still open (nothing forced)');
  // pick the school with a real button press
  g.press(0,0);g.step(dt);g.release(0,0);g.step(dt);
  const pk=G.levelupPicks&&G.levelupPicks[0];
  say(G.players[0].school!=null&&pk&&!pk.done&&pk.chain===1,'solo: school picked, chained spell row is open');
  for(let f=0;f<60*15;f++)g.step(dt); // 15 more idle seconds on the chained row
  say(G.state==='levelup'&&!G.levelupPicks[0].done,'solo: chained row still open 15s later (clock re-armed, never forces)');
  for(let f=0;f<60;f++)g.step(dt);
  g.press(0,0);g.step(dt);g.release(0,0);g.step(dt);
  const p=G.players[0],owned=Object.keys(p.weapons).filter(w=>w!=='blaster');
  say(owned.length===1&&G.state==='play','solo: the spell was the player\'s own press ('+owned+')');
}
// --- 2p: P1 picks, P2 idles → forced after the window ---
{
  const g=boot(11);g.addPad();g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('joinPlayer')(1,0);g.ev('startRun')('classic');
  const G=g.G;
  for(let f=0;f<60*160&&G.state!=='levelup';f++){
    for(const p of G.players){const pad=g.pads[p.padIndex];let best=null,bd=1e12;
      for(const e of G.enemies){if(e.dead||e.vulnMul===0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;best=e;}}
      if(best){const d=Math.sqrt(bd)||1;pad.axes[0]=(best.x-p.x)/d;pad.axes[1]=(best.y-p.y)/d;}
      p.hp=p.maxhp;}
    g.step(dt);
  }
  say(G.state==='levelup','2p reached a draft');
  // P1 resolves school + chained spell; P2 never touches the pad
  for(let i=0;i<2;i++){for(let f=0;f<40;f++)g.step(dt);g.press(0,0);g.step(dt);g.release(0,0);g.step(dt);}
  say(G.levelupPicks&&G.levelupPicks.some(pk=>pk.done),'2p: P1 finished picking');
  for(let f=0;f<60*25&&G.state==='levelup';f++)g.step(dt);
  say(G.state!=='levelup'&&G.players[1].school!=null,'2p: idle P2 was force-picked after the window (party not held hostage)');
}
