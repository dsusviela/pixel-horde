// Event Playground end-to-end smoke and mechanic test.
// Runs the ten-wave playground with 1, 2, and 4 players, renders throughout,
// and verifies that every prototype performs its actual movement interaction.
import {boot} from './headless.mjs';

let failed=0;
const say=(ok,msg)=>{console.log((ok?'ok   ':'FAIL ')+msg);if(!ok)failed=1;};
const parties=process.env.NP?process.env.NP.split(',').map(Number):[1,2,4];

for(const NP of parties){
  const g=boot(40+NP,'playground.html');
  for(let i=0;i<NP;i++)g.addPad();
  g.G.state='title';
  for(let i=0;i<NP;i++)g.ev('joinPlayer')(i,0);
  g.ev('startRun')('classic');
  const G=g.G,seen=new Set();
  let cinderCore=0,bloomAwake=0,moth=0,shrineCharged=0,runesTouched=0;
  let crystalRaised=0,crystalBroken=0,ghostSeen=0,calderaLava=0,calderaCycles=0,calderaSlams=0,bossArrivalLevel=0;
  let bossP2=0,bossP3=0,maxEnemies=0,maxGems=0,maxFx=0,heartDrops=0,maxCores=0,maxBlooms=0;
  let stoppedWithEnemies=0,normalIntermission=0,takeoverVacuum=0;
  // Slagmaw body language: the boss must stay silent (no flash/subFlash of
  // its own once its intro is over) and its reaction beats must fire
  const bossTexts=new Set();let lastSub=null,chompSeen=0,fedSeen=0,recoverSeen=0,hammerDrawn=0;
  const heartSeen=new WeakSet();
  const dt=1/60;

  for(let f=0;f<60*1000;f++){
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;p.dmgMul=G.wave<10?1.25:3.5;}
    if(G.state==='levelup'){
      for(const pick of G.levelupPicks)if(!pick.done)g.ev('takeOffer')(pick,true);
      if(G.levelupPicks.every(p=>p.done))g.ev('finishLevelup')();
      continue;
    }

    const P=G.wavePat;
    if(G.wave>=2&&G.wave<=9&&G.waveState==='clear'&&G.enemies.some(e=>!e.dead&&!e.boss&&!e.playAnchor))stoppedWithEnemies=1;
    if(G.wave>=2&&G.wave<=9&&G.waveState==='inter')normalIntermission=1;
    if(G.descent&&G.vacuumT>0)takeoverVacuum=1;
    if(P&&P.ei>0)seen.add(P.id);
    // Movement bot: prioritize the opportunity. Dormant gardens require
    // approach; other opportunity actors become proximity-auto-aim targets.
    for(const p of G.players){
      const pad=g.pads[p.padIndex];if(!pad)continue;
      let tx=null,ty=null,bd=Infinity;
      if(P&&P.bloom)for(const garden of P.bloom.gardens)if(!garden.awake){
        const d=(garden.x-p.x)**2+(garden.y-p.y)**2;if(d<bd){bd=d;tx=garden.x;ty=garden.y;}
      }
      if(P&&P.shrines&&P.shrines.cur){const s=P.shrines.cur,d=(s.x-p.x)**2+(s.y-p.y)**2;if(d<bd){bd=d;tx=s.x;ty=s.y;}}
      if(P&&P.runes&&P.runes.cur){const c=P.runes.cur,d=(c.x-p.x)**2+(c.y-p.y)**2;if(d<bd){bd=d;tx=c.x;ty=c.y;}}
      if(P&&P.ring&&P.ring.cast){const c=P.ring.cast,d=(c.x-p.x)**2+(c.y-p.y)**2;if(d<bd){bd=d;tx=c.x;ty=c.y;}}
      if(tx===null)for(const e of G.enemies){
        if(e.dead||e.vulnMul===0||!e.playTarget)continue;
        const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<bd){bd=d;tx=e.x;ty=e.y;}
      }
      if(tx===null){
        // Keep circling so the ordinary horde stays in survivor-style motion.
        const a=G.time*0.55+p.idx*Math.PI*2/Math.max(1,NP);
        tx=G.cam.x+Math.cos(a)*150;ty=G.cam.y+Math.sin(a)*90;bd=(tx-p.x)**2+(ty-p.y)**2;
      }
      if(bd>20*20){const d=Math.sqrt(bd)||1;pad.axes[0]=(tx-p.x)/d;pad.axes[1]=(ty-p.y)/d;}
      else{pad.axes[0]=0;pad.axes[1]=0;}
    }

    g.step(dt);
    if(f%10===0)g.render();
    maxEnemies=Math.max(maxEnemies,G.enemies.filter(e=>!e.dead).length);
    maxCores=Math.max(maxCores,G.enemies.filter(e=>!e.dead&&e.cinderCore).length);
    if(P&&P.bloom)maxBlooms=Math.max(maxBlooms,P.bloom.gardens.filter(x=>x.e&&!x.e.dead).length);
    maxGems=Math.max(maxGems,G.gems.filter(x=>!x.dead).length);
    maxFx=Math.max(maxFx,G.fx.length);
    for(const e of G.enemies){
      if(e.cinderCore)cinderCore=1;
      if(e.moth)moth=1;
    }
    if(P&&P.bloom&&P.bloom.gardens.some(x=>x.awake))bloomAwake=1;
    if(P&&P.shrines&&P.shrines.completed>0)shrineCharged=1;
    if(P&&P.runes)runesTouched=Math.max(runesTouched,P.runes.touched);
    if(P&&P.crystal){crystalRaised=Math.max(crystalRaised,P.crystal.raised);crystalBroken=Math.max(crystalBroken,P.crystal.broken);if(G.enemies.some(e=>e.ghost&&!e.dead))ghostSeen=1;}
    if(P&&P.caldera){calderaLava=Math.max(calderaLava,P.caldera.lavaSeen);calderaCycles=Math.max(calderaCycles,P.caldera.cycles);calderaSlams=Math.max(calderaSlams,P.caldera.slams);}
    if(G.wave<10)for(const pk of G.pickups)if(pk.type==='heart'&&!heartSeen.has(pk)){heartSeen.add(pk);heartDrops++;}
    if(G.boss&&G.boss.def&&G.boss.def.id==='slagmaw'){
      if(!bossArrivalLevel)bossArrivalLevel=G.level;
      if(G.boss.phase>=2)bossP2=1;if(G.boss.phase>=3)bossP3=1;
      const a=G.boss.ai;
      if(!G.boss.dead&&a.mode!=='intro'){
        if(G.flashT>2.15&&G.flashMsg&&G.flashMsg!=='VACUUM!')bossTexts.add('flash:'+G.flashMsg); // the vacuum pickup banner is the player's, not the boss's
        if(G.subFlashT>0&&G.subFlash&&G.subFlash!==lastSub){lastSub=G.subFlash;bossTexts.add('sub:'+G.subFlash);}
      }
      if(a.chompT>0)chompSeen=1;if(a.fedN>0)fedSeen=1;if(a.recoverT>0)recoverSeen=1;
      if(!hammerDrawn&&f%10===0){ // the draw hook runs against the stub canvas: it must not throw
        const ok=(()=>{try{G.boss.def.draw(g.ev('document.createElement("canvas").getContext("2d")'),100,100,G.boss);return 1;}catch(err){console.log('draw threw',err.message);return -1;}})();
        hammerDrawn=ok;
      }
    }
    if(G.state==='victory')break;
  }

  const tag=' ['+NP+'p]';
  for(const id of ['cinderfall','obsidianbloom','embermoths','sunshrines','runerun','crystalmaze','treasurestorm','caldera'])
    say(seen.has(id),id+' activated'+tag);
  say(cinderCore,'Cinderfall produced breakable XP cores'+tag);
  say(maxCores<=1+Math.ceil(NP/2),'Cinderfall showed only one readable core batch (peak '+maxCores+')'+tag);
  say(bloomAwake,'Obsidian Bloom woke through player proximity'+tag);
  say(maxBlooms<=1,'Obsidian Bloom showed only one garden at a time (peak '+maxBlooms+')'+tag);
  say(moth,'Ember Moths crossed the arena'+tag);
  say(shrineCharged,'Sun Shrine charged through player presence'+tag);
  say(runesTouched>=4,'Rune Run paid a visible movement chain ('+runesTouched+' touches)'+tag);
  say(crystalRaised>=300&&crystalBroken>=8,'Crystal Maze raised a shard field and the party broke through it ('+crystalRaised+' raised / '+crystalBroken+' broken)'+tag);
  say(ghostSeen,'Crystal Maze spawned ghosts'+tag);
  say(calderaLava>0&&calderaCycles>=2,'Caldera cycled short-lived Slagmaw lava rivers ('+calderaCycles+' cycles / '+calderaLava+' tiles)'+tag);
  say(calderaSlams>0,'Caldera Smashers resolved the orange knockback slam ('+calderaSlams+' slams)'+tag);
  say(bossArrivalLevel>=10&&bossArrivalLevel<=11,'boss arrival hit target level 10-11 (L'+bossArrivalLevel+')'+tag);
  say(bossP2&&bossP3,'Slagmaw reached all three phases'+tag);
  say(bossTexts.size===0,'Slagmaw stayed silent: no flash/subFlash during the fight'+(bossTexts.size?' ('+[...bossTexts].join(' | ')+')':'')+tag);
  say(!fedSeen||chompSeen,'Slagmaw chomped every offering it ate (the heal readout)'+(fedSeen?'':' [none fed]')+tag);
  say(recoverSeen,'Slagmaw held the recovery beat after a blow'+tag);
  say(hammerDrawn===1,'Slagmaw draw hook (the hammer) rendered without throwing'+tag);
  {
    const pose=g.ev('slagPose'),mk=(cast,castP,ringDir)=>({ai:{mode:'active',cast,ringDir:ringDir||1,recoverT:0},castP,phase:1,spr:G.boss?G.boss.spr:null,scale:2,r:20});
    say(pose(mk('slam',0.7)).ang<-0.4&&pose(mk('slam',0.7)).arm>2.5,'slam pose: arm and hammer over the head at 70%'+tag);
    say(pose(mk('slam',0.99)).ang<-2.0,'slam pose: hammer coming down at 99%'+tag);
    say(pose(mk('ring',0.5)).trail===0&&pose(mk('ring',0.9)).trail>0&&Math.abs(pose(mk('ring',0.5)).ang-Math.PI/2)<0.1,'cinder ring pose: held straight out, then the sweep'+tag);
    say(pose(mk('ring',0.9,-1)).ang<0&&pose(mk('ring',0.9,-1)).mouth>0.5,'inward ring pose: scooped in, the maw inhales'+tag);
    say(pose(mk('brand',0.3)).glow>0.5&&pose(mk('brand',0.3)).eyes===1,'brand pose: red-hot core and flaring eyes'+tag);
  }
  say(G.state==='victory','the ten-wave playground reached victory'+tag);
  say(stoppedWithEnemies,'wave timers stopped spawning while enemies remained'+tag);
  say(!normalIntermission,'waves 2-9 used no hard intermission'+tag);
  say(G.softTransitions===9,'all nine trash waves ended on their timers ('+G.softTransitions+')'+tag);
  say(G.softOverlaps>0,'survivors carried into following waves ('+G.softOverlaps+' carried)'+tag);
  say(G.softCrumbled>0,'stale/takeover enemies crumbled without XP ('+G.softCrumbled+')'+tag);
  say(takeoverVacuum,'forced vacuum ran during cave movement takeover'+tag);
  const densityFloor=NP===1?45:NP===2?45:90;
  say(maxEnemies>=densityFloor,'survivor density reached '+densityFloor+'+ live enemies (peak '+maxEnemies+')'+tag);
  say(maxEnemies<320,'live enemy count stayed bounded (peak '+maxEnemies+')'+tag);
  say(maxGems<=390,'loose gem count stayed bounded (peak '+maxGems+')'+tag);
  say(maxFx<500,'effect count stayed bounded (peak '+maxFx+')'+tag);
  say(heartDrops<=3*Math.ceil(NP/2)+8,'healing drops stayed scarce ('+heartDrops+' hearts)'+tag);
  console.log('  end:',G.state,'wave',G.wave,'level',G.level,'time',Math.round(G.time)+'s');
}

process.exit(failed);
