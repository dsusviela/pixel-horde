// ============================================================
// PIXEL HORDE — online multiplayer client (net.js)
//
// Classic script, loaded AFTER the game's own <script> so it shares the
// game's global scope (G, sfx, render, pollPads internals, sprite consts...).
// Host-authoritative: the host browser runs the whole simulation; each guest
// becomes one virtual gamepad on the host and renders streamed snapshots.
//
// Activation is strictly via URL params — with no params NET.mode is 'off'
// and every hook in index.html stays inert:
//   ?host            host a room with a generated 4-char code
//   ?host=CODE       host a room with a chosen code (4-8 chars A-Z 0-9)
//   ?join=CODE       join a room as a guest
//   ?relay=wss://... override the relay server URL
//
// Relay protocol (see server/worker.js and tools/relay-local.mjs):
//   connect  RELAY + '/ws/' + CODE + '?role=host'|'guest'
//   -> host  {t:'hosting'}  {t:'join',id}  {t:'leave',id}
//            guest JSON arrives stamped {from:id}
//   -> guest {t:'welcome',id}; host frames are broadcast to all guests,
//            {to:id} targets one guest
//   closes   4000 host-left  4001 already-hosted  4002 no-room  4003 full
// ============================================================
var NET=(function(){
'use strict';

// ---------- activation ----------
var CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(){
  var s='';
  for(var i=0;i<4;i++)s+=CODE_ALPHABET[(Math.random()*CODE_ALPHABET.length)|0];
  return s;
}
var search=(typeof location!=='undefined'&&location.search)?location.search:'';
var params;
try{params=new URLSearchParams(search);}catch(e){params={has:function(){return false;},get:function(){return null;}};}
var mode='off',code=null;
if(params.has('host')){
  var hv=String(params.get('host')||'').toUpperCase();
  code=/^[A-Z0-9]{4,8}$/.test(hv)?hv:genCode();
  mode='host';
}else if(params.has('join')){
  var jv=String(params.get('join')||'').toUpperCase();
  if(/^[A-Z0-9]{4,8}$/.test(jv)){code=jv;mode='guest';}
  else console.warn('[net] ?join code must be 4-8 chars A-Z 0-9 — staying offline');
}
// Default relay: the deployed worker when the game is served over the web
// (e.g. GitHub Pages), the local dev relay when opened from disk/localhost.
var LOCAL_PAGE=typeof location!=='undefined'&&
  (location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1');
var RELAY=params.get('relay')
  ||(typeof window!=='undefined'&&window.PH_RELAY)
  ||(LOCAL_PAGE?'ws://localhost:8787':'wss://pixel-horde-relay.dsusviela.workers.dev');

// ---------- shared state ----------
var ws=null;
var status='off';          // 'off' | 'connecting' | 'online' | 'dead'
var deadWhy='';            // human-readable close reason for the overlay
var guests=new Map();      // host: id -> {id, pad}
var nidNext=1;             // host: network ids stamped onto entities
var snapTimer=null;        // host: snapshot interval handle
var needTiles=true;        // host: force tileOverride into the next snapshot
var lastArenaSig='(none)'; // host: change detector for terrain edits
var ev={sounds:new Set(),bursts:[]}; // host: feel events drained per snapshot
var snapCount=0;           // guest: snapshots applied so far
var snapAtMs=0,snapGapS=0.07; // guest: interpolation clock
var camSeeded=false;       // guest: camera initialised from first snapshot
var lastInputMs=0,accMask=0;  // guest: input pacing + tap-safe button OR
var guestId=null;

var gw=(typeof window!=='undefined')?window:(typeof globalThis!=='undefined'?globalThis:{});
function nowMs(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}
function r1(v){return Math.round(v*10)/10;}
function r2(v){return Math.round(v*100)/100;}

// ---------- sprite / def lookup tables (lazy: game consts must exist) ----------
// Every canvas that can appear as enemy.spr / fx.icon / ai.crown, keyed by a
// stable name so the host can serialize a string and the guest can rebuild
// the canvas reference.
var SPR=null,SPRREV=null,DEFS=null;
function sprInit(){
  if(SPR)return;
  SPR={};SPRREV=new Map();
  var reg=function(n,c){if(c){SPR[n]=c;SPRREV.set(c,n);}};
  try{
    reg('chaser',chaserSprite);reg('swarm',swarmSprite);reg('spit',spitSprite);
    reg('tank',tankSprite);reg('bomb',bombSprite);
    reg('slagPup',slagPupSprite);reg('slagmaw',slagmawSprite);reg('slagmawOpen',slagmawOpenSprite);
    reg('geminox',geminoxSprite);reg('geminoxP2',geminoxP2Sprite);reg('geminoxSplit',geminoxSplitSprite);
    reg('pyraxis',pyraxisSprite);reg('pyraxisP2',pyraxisP2Sprite);reg('pyraxisShattered',pyraxisShatteredSprite);
    reg('crownP2',pyraxisCrownP2);reg('crownP3',pyraxisCrownP3);
    reg('emberling',emberlingSprite);reg('pylon',pylonSprite);
    for(var i=0;i<4;i++){reg('we'+i,worldeaterSpr[i]);reg('thrall'+i,weThrallSpr[i]);}
    reg('slamWarn',slamWarnSprite);
  }catch(e){console.warn('[net] sprite registry incomplete:',e&&e.message);}
}
function defsInit(){
  if(DEFS)return;
  DEFS={};
  try{
    for(var i=0;i<CLASSIC_BOSSES.length;i++)DEFS[CLASSIC_BOSSES[i].id]=CLASSIC_BOSSES[i];
    DEFS.pylon=PYLON_DEF; // PYLON_DEF has no .id — the encoder maps it to 'pylon'
  }catch(e){console.warn('[net] def registry incomplete:',e&&e.message);}
}

// ============================================================
// HOST: serialize G into a JSON-safe snapshot
// ============================================================
function encWeapons(wsrc){
  var o={};
  for(var id in wsrc){var w=wsrc[id];o[id]={lv:w.lv,evo:w.evo?1:0,ang:r2(w.ang||0)};}
  return o;
}
function encPlayer(p){
  return {idx:p.idx,x:r1(p.x),y:r1(p.y),col:p.col,hp:r1(p.hp),maxhp:p.maxhp,
    dead:p.dead?1:0,reviveP:r2(p.reviveP||0),invuln:r2(p.invuln||0),flash:r2(p.flash||0),
    anim:r2(p.anim||0),kills:p.kills,revives:p.revives,
    arrow:p.arrow?[r2(p.arrow[0]),r2(p.arrow[1])]:null,
    weapons:encWeapons(p.weapons),
    // relic ids only — the guest just draws the HUD pips, the host casts them
    relics:p.relics?Object.keys(p.relics):[]};
}
function encEnemy(e){
  if(e.nid===undefined)e.nid=nidNext++;
  var o={nid:e.nid,type:e.type,x:r1(e.x),y:r1(e.y),r:e.r,hp:r1(e.hp),maxhp:r1(e.maxhp)};
  if(e.flash)o.flash=r2(e.flash);
  if(e.scale&&e.scale!==1)o.scale=e.scale;
  if(e.elite)o.elite=1;
  if(e.hunted)o.hunted=1;
  if(e.fuse!==undefined&&e.fuse>=0)o.fuse=r2(e.fuse);
  var sk=SPRREV.get(e.spr);
  if(sk)o.spr=sk;
  if(e.def)o.def=e.def.id||'pylon';
  if(e.boss){
    o.boss=1;o.name=e.name;o.barCol=e.barCol;o.phase=e.phase;o.phaseCount=e.phaseCount;
    if(e.gates)o.gates=e.gates;
    if(e.castName){o.castName=e.castName;o.castP=r2(e.castP||0);}
    if(e.skullIcon)o.skullIcon=1;
    var a=e.ai;
    if(a){
      o.ai={};
      if(a.pal!==undefined)o.ai.pal=a.pal;
      if(a.gazeLive)o.ai.gazeLive=1;
      if(a.charge!==undefined)o.ai.charge=a.charge;
      if(a.cvx!==undefined)o.ai.cvx=r2(a.cvx);
      if(a.cvy!==undefined)o.ai.cvy=r2(a.cvy);
      if(a.enrageT!==undefined)o.ai.enrageT=r1(a.enrageT);
      if(a.mode!==undefined)o.ai.mode=a.mode;
      if(a.t!==undefined)o.ai.t=r2(a.t);
      if(a.crown){var ck=SPRREV.get(a.crown);if(ck)o.ai.crown=ck;}
    }
  }
  return o;
}
// fx carry live refs (boss/p), canvases (icon), Sets (hit) and closures
// (onPop) — encode only what drawFx reads, as plain data.
var FX_SCALARS=['x','y','r','t','dur','w','gapA','gaps','gapW','spd','dir',
  'x1','y1','x2','y2','heal','locked','fizzled','active',
  // the BOSS RUSH mechanic and relic fx (sweep/line/cone/pole/orbit/beam/defile)
  'a','ang','len','half','n','rad','sign','rmax','r0','r1',
  // school spell fx: sbloom/sring point count and phase offset
  'pts','seed'];
function encFx(f){
  var o={kind:f.kind};
  if(f.ground)o.ground=1;
  for(var i=0;i<FX_SCALARS.length;i++){
    var k=FX_SCALARS[i],v=f[k];
    if(v===undefined||v===null)continue;
    var tv=typeof v;
    if(tv==='number')o[k]=r2(v);
    else if(tv==='boolean')o[k]=v?1:0;
    else if(tv==='string')o[k]=v;
  }
  if(f.col)o.col=f.col;
  // the constellation an illusion cast leaves behind: a flat [x,y,...] path
  if(f.line&&f.line.length)o.line=f.line.map(r1);
  if(f.shape)o.shape=f.shape;
  if(f.mode)o.mode=f.mode;
  if(f.icon){var ik=SPRREV.get(f.icon);if(ik)o.icon=ik;}
  if(f.p&&f.p.idx!==undefined)o.pIdx=f.p.idx;
  // relic fx are drawn around their caster, so the guest needs that link too
  if(f.own&&f.own.idx!==undefined)o.ownIdx=f.own.idx;
  if(f.kind==='shadow'&&f.boss){
    if(f.boss.nid===undefined)f.boss.nid=nidNext++;
    o.bossNid=f.boss.nid;
  }
  return o;
}
function arenaSig(){
  var a=G.arena;
  return a?(a.x+','+a.y+','+a.w+','+a.h+','+a.pillars.length):'(none)';
}
function encodeSnapshot(){
  sprInit();
  var bossNid=null;
  if(G.boss&&!G.boss.dead){
    if(G.boss.nid===undefined)G.boss.nid=nidNext++;
    bossNid=G.boss.nid;
  }
  var snap={t:'snap',
    state:G.state,mode:G.mode,modeSel:G.modeSel,rushStart:G.rushStart,startWave:G.startWave,
    time:r2(G.time),shake:r1(G.shake),
    xp:r1(G.xp),level:G.level,kills:G.kills,
    wave:G.wave,waveState:G.waveState,waveT:r2(G.waveT),interLen:G.interLen,
    waveQuota:G.waveQuota,waveSpawned:G.waveSpawned,
    flashMsg:G.flashMsg,flashT:r2(G.flashT),subFlash:G.subFlash,subFlashT:r2(G.subFlashT),
    bossTint:G.bossTint,weSince:G.weSince,overSince:G.overSince,
    deaths:G.deaths,bossKills:G.bossKills,bossTimes:G.bossTimes,buffTally:G.buffTally,
    levelupT:r2(G.levelupT||0),
    slow:(typeof slowT==='number')?r2(Math.max(0,slowT)):0,
    cam:{x:r1(G.cam.x),y:r1(G.cam.y),w:r1(G.cam.w)},
    arena:G.arena?{x:G.arena.x,y:G.arena.y,w:G.arena.w,h:G.arena.h,
      pillars:G.arena.pillars.map(function(q){return {x:q.x,y:q.y,hw:q.hw,hh:q.hh};})}:null,
    creep:G.creep?Array.from(G.creep):null,
    players:G.players.map(encPlayer),
    enemies:G.enemies.filter(function(e){return !e.dead;}).map(encEnemy),
    // glow/prism/star ride along: they are what makes a school bolt look like a
    // spell instead of a pellet, and a guest seeing flat squares while the
    // host sees starlight is the same run rendered as two different games.
    // All are omitted unless set, so OG weapon fire costs nothing extra.
    // `wake` is deliberately NOT sent — a 12-point ribbon per bolt would
    // dominate the snapshot; guests rebuild their own from the bolt's motion.
    bullets:G.bullets.filter(function(b){return !b.dead;}).map(function(b){
      var o={x:r1(b.x),y:r1(b.y),vx:r1(b.vx||0),vy:r1(b.vy||0),r:b.r,col:b.col};
      if(b.glow)o.glow=1;
      if(b.prism)o.prism=b.prism;
      if(b.star)o.star=b.star;
      if(b.met)o.met=1;
      if(b.trail){o.trail=1;if(b.trailCol)o.trailCol=b.trailCol;if(b.starTrail)o.starTrail=1;}
      return o;}),
    ebullets:G.ebullets.filter(function(b){return !b.dead;}).map(function(b){
      return {x:r1(b.x),y:r1(b.y),vx:r1(b.vx||0),vy:r1(b.vy||0),r:b.r,col:b.col};}),
    gems:G.gems.filter(function(g){return !g.dead;}).map(function(g){
      return {x:r1(g.x),y:r1(g.y),v:g.v,t:r2(g.t||0)};}),
    pickups:G.pickups.filter(function(p){return !p.dead;}).map(function(p){
      return {x:r1(p.x),y:r1(p.y),type:p.type,t:r2(p.t||0)};}),
    crates:G.crates.filter(function(c){return !c.dead;}).map(function(c){
      return {x:r1(c.x),y:r1(c.y)};}),
    texts:G.texts.map(function(tx){
      return {x:r1(tx.x),y:r1(tx.y),str:String(tx.str),col:tx.col,t:r2(tx.t),vy:tx.vy};}),
    fx:G.fx.map(encFx),
    bossNid:bossNid,
    levelupPicks:G.levelupPicks?G.levelupPicks.map(function(pk){
      return {pIdx:pk.p.idx,sel:pk.sel,done:pk.done?1:0,
        offers:pk.offers.map(function(o){return {kind:o.kind,id:o.id};})};}):null,
    ev:{s:Array.from(ev.sounds),b:ev.bursts.slice()}
  };
  var sig=arenaSig();
  if(needTiles||sig!==lastArenaSig){
    snap.tiles=Array.from(G.tileOverride);
    lastArenaSig=sig;
    needTiles=false;
  }
  ev.sounds.clear();ev.bursts.length=0;
  return snap;
}

// ============================================================
// GUEST: apply a snapshot into G (no update() ever runs guest-side)
// ============================================================
// Entities are persistent objects keyed by idx (players) / nid (enemies) so
// positions can be lerped from where they were drawn last frame (_px,_py)
// toward the newest snapshot position (_tx,_ty).
var gPlayers=new Map(),gEnemies=new Map();
function lerpTrack(obj,x,y){
  if(obj._tx===undefined){obj._px=x;obj._py=y;}
  else{obj._px=obj.x;obj._py=obj.y;}
  obj._tx=x;obj._ty=y;
  obj.x=obj._px;obj.y=obj._py;
}
function applySnapshot(snap){
  sprInit();defsInit();
  // ---- plain scalars ----
  G.state=snap.state;G.mode=snap.mode;G.modeSel=snap.modeSel;
  G.rushStart=snap.rushStart||1;G.startWave=snap.startWave||1;
  G.time=snap.time;G.shake=snap.shake;
  G.xp=snap.xp;G.level=snap.level;G.kills=snap.kills;
  G.wave=snap.wave;G.waveState=snap.waveState;G.waveT=snap.waveT;G.interLen=snap.interLen;
  G.waveQuota=snap.waveQuota;G.waveSpawned=snap.waveSpawned;
  G.flashMsg=snap.flashMsg;G.flashT=snap.flashT;G.subFlash=snap.subFlash;G.subFlashT=snap.subFlashT;
  G.bossTint=snap.bossTint;G.weSince=snap.weSince;G.overSince=snap.overSince;
  G.deaths=snap.deaths;G.bossKills=snap.bossKills;
  G.bossTimes=snap.bossTimes||[];G.buffTally=snap.buffTally||{};
  G.levelupT=snap.levelupT||0;
  if(typeof slowT==='number')slowT=Math.max(slowT,snap.slow||0);
  // ---- camera: seeded once, then updateCamera() runs locally for smoothness ----
  if(!camSeeded&&snap.cam){
    G.cam.x=snap.cam.x;G.cam.y=snap.cam.y;G.cam.w=snap.cam.w;G.cam.tw=snap.cam.w;
    camSeeded=true;
  }
  // ---- terrain ----
  var a=snap.arena;
  G.arena=a?{x:a.x,y:a.y,w:a.w,h:a.h,pillars:a.pillars||[]}:null;
  G.creep=snap.creep?new Set(snap.creep):null;
  if(snap.tiles){
    G.tileOverride=new Map(snap.tiles);
    try{if(typeof chunkCanvases!=='undefined')chunkCanvases.clear();}catch(e){}
  }
  // ---- players ----
  var seenP=new Set();
  G.players=snap.players.map(function(sp){
    var p=gPlayers.get(sp.idx);
    if(!p){p={idx:sp.idx,padIndex:null,r:5};gPlayers.set(sp.idx,p);}
    lerpTrack(p,sp.x,sp.y);
    p.col=sp.col;p.hp=sp.hp;p.maxhp=sp.maxhp;p.dead=!!sp.dead;
    p.reviveP=sp.reviveP;p.invuln=sp.invuln;p.flash=sp.flash;p.anim=sp.anim;
    p.kills=sp.kills;p.revives=sp.revives;p.arrow=sp.arrow||null;
    var w={};
    for(var id in sp.weapons){var sw=sp.weapons[id];w[id]={lv:sw.lv,evo:!!sw.evo,ang:sw.ang};}
    p.weapons=w;
    var rl={};
    if(sp.relics)for(var ri=0;ri<sp.relics.length;ri++)rl[sp.relics[ri]]={t:0};
    p.relics=rl;
    seenP.add(sp.idx);
    return p;
  });
  gPlayers.forEach(function(_,k){if(!seenP.has(k))gPlayers.delete(k);});
  // ---- enemies ----
  var seenE=new Set();
  G.enemies=snap.enemies.map(function(se){
    var e=gEnemies.get(se.nid);
    if(!e){e={nid:se.nid};gEnemies.set(se.nid,e);}
    lerpTrack(e,se.x,se.y);
    e.type=se.type;e.r=se.r;e.hp=se.hp;e.maxhp=se.maxhp;e.flash=se.flash||0;
    e.scale=se.scale||1;e.elite=!!se.elite;e.hunted=!!se.hunted;
    e.fuse=(se.fuse!==undefined)?se.fuse:-1;e.dead=false;
    e.spr=(se.spr&&SPR[se.spr])
      ||(typeof ETYPES!=='undefined'&&ETYPES[se.type]&&ETYPES[se.type].spr)
      ||SPR.chaser;
    e.def=se.def?(DEFS[se.def]||null):null;
    e.boss=!!se.boss;
    if(se.boss){
      e.name=se.name;e.barCol=se.barCol;e.phase=se.phase;e.phaseCount=se.phaseCount;
      e.gates=se.gates||null;e.castName=se.castName||null;e.castP=se.castP||0;
      e.skullIcon=se.skullIcon?1:0;
      var sa=se.ai||{};
      e.ai={pal:sa.pal||0,gazeLive:sa.gazeLive?1:0,charge:sa.charge,
        cvx:sa.cvx||0,cvy:sa.cvy||0,
        enrageT:(sa.enrageT!==undefined)?sa.enrageT:99,
        mode:sa.mode,t:(sa.t!==undefined)?sa.t:0,
        crown:sa.crown?(SPR[sa.crown]||null):null};
    }else{e.castName=null;e.ai=undefined;}
    seenE.add(se.nid);
    return e;
  });
  gEnemies.forEach(function(_,k){if(!seenE.has(k))gEnemies.delete(k);});
  // ---- simple collections (replaced wholesale, dead-reckoned/ticked locally) ----
  G.bullets=snap.bullets;
  G.ebullets=snap.ebullets;
  G.gems=snap.gems;
  G.pickups=snap.pickups;
  G.crates=snap.crates;
  G.texts=snap.texts;
  // ---- fx: rebuild live refs from indices/names ----
  G.fx=snap.fx.map(function(sf){
    var f={};
    for(var k in sf)f[k]=sf[k];
    if(sf.icon)f.icon=SPR[sf.icon]||null;
    if(sf.pIdx!==undefined)f.p=gPlayers.get(sf.pIdx)||null;
    if(sf.ownIdx!==undefined)f.own=gPlayers.get(sf.ownIdx)||null;
    if(sf.bossNid!==undefined)f.boss=gEnemies.get(sf.bossNid)||null;
    return f;
  });
  // ---- boss alias must point into G.enemies ----
  G.boss=(snap.bossNid!==null&&snap.bossNid!==undefined)?(gEnemies.get(snap.bossNid)||null):null;
  // ---- level-up picks: p ref rebuilt onto the guest's player copies ----
  G.levelupPicks=snap.levelupPicks?snap.levelupPicks.map(function(pk){
    var p=gPlayers.get(pk.pIdx)||{idx:pk.pIdx,col:0,dead:false,weapons:{}};
    var offers=pk.offers.map(function(o){return {kind:o.kind,id:o.id};});
    // renderLevelup reads p.weapons[id].lv for 'up' cards — never let it be undefined
    for(var i=0;i<offers.length;i++){
      var o=offers[i];
      if(o.kind==='up'&&!(p.weapons&&p.weapons[o.id]))
        (p.weapons||(p.weapons={}))[o.id]={lv:1,evo:false,ang:0};
    }
    return {p:p,offers:offers,sel:pk.sel,done:!!pk.done};
  }):null;
  // ---- feel events: sounds + big particle bursts ----
  if(snap.ev){
    var i;
    try{
      var s=snap.ev.s||[];
      for(i=0;i<s.length;i++)sfx(s[i]);
    }catch(e){}
    try{
      var bs=snap.ev.b||[];
      for(i=0;i<bs.length;i++){
        var b=bs[i];
        if(b[5])addSparkles(b[0],b[1],b[2],b[3],b[4]);
        else addParticles(b[0],b[1],b[2],b[3],b[4]);
      }
    }catch(e){}
  }
  var t=nowMs();
  if(snapCount>0)snapGapS=Math.min(0.25,Math.max(0.03,(t-snapAtMs)/1000));
  snapAtMs=t;
  snapCount++;
}

// ---------- guest per-frame: lerp + cosmetic timers ----------
function guestLerp(){
  var alpha=Math.min(1,((nowMs()-snapAtMs)/1000)/snapGapS);
  var i,o;
  for(i=0;i<G.players.length;i++){
    o=G.players[i];
    if(o._tx===undefined)continue;
    o.x=o._px+(o._tx-o._px)*alpha;
    o.y=o._py+(o._ty-o._py)*alpha;
  }
  for(i=0;i<G.enemies.length;i++){
    o=G.enemies[i];
    if(o._tx===undefined)continue;
    o.x=o._px+(o._tx-o._px)*alpha;
    o.y=o._py+(o._ty-o._py)*alpha;
  }
}
function guestTick(dt){
  G.time+=dt;
  if(G.flashT>0)G.flashT-=dt;
  if(G.subFlashT>0)G.subFlashT-=dt;
  if(G.shake>0)G.shake=Math.max(0,G.shake-dt*14);
  if(G.pflash>0)G.pflash=Math.max(0,G.pflash-dt*2.6);
  var i;
  for(i=0;i<G.particles.length;i++){
    var pt=G.particles[i];
    pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.t-=dt;
    // same drag the host applies: stars must coast to a stop and hang, or the
    // guest's version of every illusion burst flies off screen instead
    if(pt.drag){var df=Math.max(0,1-pt.drag*dt);pt.vx*=df;pt.vy*=df;}
  }
  G.particles=G.particles.filter(function(p){return p.t>0;});
  for(i=0;i<G.texts.length;i++){G.texts[i].y+=G.texts[i].vy*dt;G.texts[i].t-=dt;}
  G.texts=G.texts.filter(function(t){return t.t>0;});
  for(i=0;i<G.fx.length;i++){
    var f=G.fx[i];
    f.t-=dt;
    if(f.kind==='ring'&&f.spd)f.r=Math.max(0,f.r+(f.dir||1)*f.spd*dt);
  }
  G.fx=G.fx.filter(function(f){return f.t>-0.5;});
  // Bullets: integrate, then rebuild the cosmetics the host never sends. The
  // ribbon and the star wake are pure functions of the bolt's own motion, so
  // the guest can grow them locally for free rather than paying snapshot bytes
  // for a 12-point path per bolt. Homing is invisible here on purpose: the
  // host re-sends corrected vx/vy every snapshot, so the curve replays itself.
  for(i=0;i<G.bullets.length;i++){
    var b=G.bullets[i];
    b.x+=(b.vx||0)*dt;b.y+=(b.vy||0)*dt;
    if(b.star){
      if(!b.wake)b.wake=[];
      b.wake.push(b.x,b.y);
      if(b.wake.length>24)b.wake.splice(0,b.wake.length-24);
    }
    if(b.trail&&Math.random()<(b.starTrail?0.9:0.6)&&G.particles.length<850){
      if(b.starTrail)G.particles.push({x:b.x+(Math.random()*4-2),y:b.y+(Math.random()*4-2),
        vx:-(b.vx||0)*0.08,vy:-(b.vy||0)*0.08-8,t:0.3+Math.random()*0.25,
        col:b.trailCol||b.col,size:1,star:1,drag:3,prism:b.prism||0});
      else G.particles.push({x:b.x,y:b.y,vx:0,vy:0,t:0.2,col:b.trailCol||b.col,size:1,spark:1});
    }
  }
  for(i=0;i<G.ebullets.length;i++){G.ebullets[i].x+=(G.ebullets[i].vx||0)*dt;G.ebullets[i].y+=(G.ebullets[i].vy||0)*dt;}
  for(i=0;i<G.gems.length;i++)G.gems[i].t+=dt;
  for(i=0;i<G.pickups.length;i++)G.pickups[i].t+=dt;
  for(i=0;i<G.players.length;i++)if(G.players[i].invuln>0)G.players[i].invuln-=dt;
}

// ---------- guest input: sample local pads, stream to the host ----------
function localPad(){
  var pads;
  try{pads=pollPads();}catch(e){return null;}
  if(!pads||!pads.length)return null;
  // prefer a real gamepad (numeric index); the keyboard pad ('kb') is last
  for(var i=0;i<pads.length;i++)
    if(typeof pads[i].index==='number')return pads[i];
  return pads[pads.length-1];
}
function sampleAndSendInput(){
  var p=localPad();
  if(!p)return;
  var m=0;
  for(var b=0;b<16&&b<p.buttons.length;b++)
    if(p.buttons[b]&&p.buttons[b].pressed)m|=1<<b;
  // OR the mask between sends so a sub-33ms tap can't fall between packets
  accMask|=m;
  var t=nowMs();
  if(t-lastInputMs>=33&&ws&&ws.readyState===1){
    try{
      ws.send(JSON.stringify({t:'input',ax:r2(p.axes[0]||0),ay:r2(p.axes[1]||0),b:accMask}));
    }catch(e){}
    accMask=m;
    lastInputMs=t;
  }
}

// The hook in index.html's frame(): returns true when this client is a guest,
// which makes the game skip update()/updateCamera() and just render.
function guestFrame(dt){
  if(mode!=='guest')return false;
  sampleAndSendInput();
  if(snapCount>0&&status==='online'){
    guestLerp();
    guestTick(dt);
    try{
      if(G.state!=='title'&&G.state!=='modesel')updateCamera(dt);
    }catch(e){}
  }else if(snapCount>0){
    // disconnected: stop patching, keep the last state fading out gracefully
    guestTick(dt);
  }
  return true;
}

// ============================================================
// HOST: virtual pads + wrappers
// ============================================================
function virtualPads(){
  if(mode!=='host')return [];
  var out=[];
  guests.forEach(function(g){out.push(g.pad);});
  return out;
}
function addGuest(id){
  var buttons=[];
  for(var i=0;i<21;i++)buttons.push({pressed:false});
  guests.set(id,{id:id,pad:{
    index:100+id,          // never collides with real pads (0-3) or 'kb'
    connected:true,mapping:'standard',buttons:buttons,axes:[0,0]
  }});
  needTiles=true; // make sure the newcomer gets the terrain overrides
  console.log('[net] guest '+id+' joined');
  try{subFlash('FRIEND '+id+' CONNECTED',3);}catch(e){}
}
function dropGuest(id){
  if(guests.delete(id)){
    console.log('[net] guest '+id+' left');
    try{subFlash('FRIEND '+id+' LEFT',3);}catch(e){}
  }
}
function hostMsg(m){
  if(m.t==='hosting'){
    status='online';
    console.log('[net] hosting room '+code+' on '+RELAY+' — friends join with ?join='+code);
    try{
      flash('ROOM CODE: '+code);
      subFlash('FRIENDS JOIN WITH ?join='+code,6);
    }catch(e){}
    if(!snapTimer)snapTimer=setInterval(sendSnapshot,66); // ~15Hz
  }
  else if(m.t==='join')addGuest(m.id);
  else if(m.t==='leave')dropGuest(m.id);
  else if(m.t==='input'&&m.from!==undefined){
    var g=guests.get(m.from);
    if(!g)return;
    g.pad.axes[0]=Math.max(-1,Math.min(1,+m.ax||0));
    g.pad.axes[1]=Math.max(-1,Math.min(1,+m.ay||0));
    var b=m.b|0;
    for(var i=0;i<21;i++)g.pad.buttons[i].pressed=i<16?!!((b>>i)&1):false;
  }
}
function sendSnapshot(){
  if(!ws||ws.readyState!==1)return;
  try{ws.send(JSON.stringify(encodeSnapshot()));}catch(e){}
}
// Wrap the feel channel: sfx names and big particle bursts get replayed on
// guests. These are top-level function declarations in the game script, i.e.
// writable window properties — reassigning them redirects every call site.
function wrapHost(){
  if(typeof gw.sfx==='function'){
    var os=gw.sfx;
    gw.sfx=function(n){ev.sounds.add(n);return os(n);};
  }
  if(typeof gw.addParticles==='function'){
    var op=gw.addParticles;
    gw.addParticles=function(x,y,c,n,s){
      if(n>=8&&ev.bursts.length<64)ev.bursts.push([r1(x),r1(y),c,n,s||60,0]);
      return op(x,y,c,n,s);
    };
  }
  if(typeof gw.addSparkles==='function'){
    var ok=gw.addSparkles;
    gw.addSparkles=function(x,y,c,n,s){
      if(n>=8&&ev.bursts.length<64)ev.bursts.push([r1(x),r1(y),c,n,s||40,1]);
      return ok(x,y,c,n,s);
    };
  }
}
// Guests must never spawn chunk loot on top of synced state (render() calls
// ensureChunkEntities); neuter it — also a writable window property.
function wrapGuest(){
  if(typeof gw.ensureChunkEntities==='function')gw.ensureChunkEntities=function(){};
}

// ---------- connection state overlay (drawn after every render) ----------
function drawOverlay(){
  if(typeof sctx==='undefined'||typeof screenC==='undefined'||typeof text!=='function')return;
  sctx.setTransform(1,0,0,1,0,0);
  var W=screenC.width,k=Math.max(0.5,W/680);
  var msg,col;
  if(mode==='host'){
    if(status==='online'){msg='ROOM '+code+' — '+guests.size+' FRIEND'+(guests.size===1?'':'S');col='#57e86b';}
    else if(status==='dead'){msg=deadWhy?('ROOM '+code+' — '+deadWhy):'RELAY LOST — PLAYING SOLO';col='#ff4d4d';}
    else{msg='ROOM '+code+' — CONNECTING';col='#ffe94a';}
  }else{
    if(status==='online')return; // clean screen while playing
    if(status==='dead'){msg='DISCONNECTED'+(deadWhy?' — '+deadWhy:'');col='#ff4d4d';}
    else{msg='JOINING ROOM '+code;col='#ffe94a';}
  }
  text(sctx,msg,W/2,Math.round(30*k),Math.max(5,Math.round(7*k)),col,'center');
}
function wrapRender(){
  if(typeof gw.render!=='function')return;
  var orr=gw.render;
  gw.render=function(){
    orr();
    try{drawOverlay();}catch(e){}
  };
}

// ---------- transport ----------
function closeReason(codeNum){
  if(codeNum===4000)return 'HOST LEFT';
  if(codeNum===4001)return 'ROOM ALREADY HOSTED';
  if(codeNum===4002)return 'NO SUCH ROOM';
  if(codeNum===4003)return 'ROOM FULL';
  return '';
}
function onDown(evc){
  var why=closeReason(evc&&evc.code);
  deadWhy=why;
  if(status==='dead')return;
  status='dead';
  console.warn('[net] connection closed'+(why?' — '+why:'')+' (code '+(evc&&evc.code)+')');
  if(mode==='host'){
    // v1: no reconnect — the host just keeps playing solo
    guests.clear();
    if(snapTimer){clearInterval(snapTimer);snapTimer=null;}
    try{subFlash('RELAY LOST — PLAYING SOLO',4);}catch(e){}
  }else{
    // v1: no reconnect — stop patching, keep rendering the last state
    try{flash('DISCONNECTED');G.flashT=5;}catch(e){}
  }
}
function guestMsg(m){
  if(m.t==='welcome'){
    guestId=m.id;
    status='online';
    console.log('[net] joined room '+code+' as guest '+m.id);
    try{subFlash('CONNECTED — ROOM '+code,3);}catch(e){}
  }
  else if(m.t==='snap'){
    try{applySnapshot(m);}catch(e){console.warn('[net] bad snapshot:',e&&e.message);}
  }
}
function connect(){
  var url=String(RELAY).replace(/\/+$/,'')+'/ws/'+code+'?role='+(mode==='host'?'host':'guest');
  status='connecting';
  try{ws=new WebSocket(url);}catch(e){
    status='dead';deadWhy='BAD RELAY URL';
    console.warn('[net] cannot open '+url+':',e&&e.message);
    return;
  }
  ws.onmessage=function(e){
    if(typeof e.data!=='string')return;
    var m;
    try{m=JSON.parse(e.data);}catch(err){return;}
    if(mode==='host')hostMsg(m);
    else guestMsg(m);
  };
  ws.onclose=onDown;
  ws.onerror=function(){}; // close always follows
}
function stop(){
  if(snapTimer){clearInterval(snapTimer);snapTimer=null;}
  if(ws){try{ws.close();}catch(e){}ws=null;}
}

// ---------- boot ----------
if(mode!=='off'){
  if(typeof WebSocket==='undefined'){
    console.warn('[net] WebSocket unavailable — staying offline');
    mode='off';
  }else{
    if(mode==='host')wrapHost();
    else wrapGuest();
    wrapRender();
    console.log('[net] mode='+mode+' room='+code+' relay='+RELAY);
    connect();
  }
}

// ---------- public surface ----------
return {
  get mode(){return mode;},
  get code(){return code;},
  get status(){return status;},
  get relay(){return RELAY;},
  virtualPads:virtualPads,   // hooked into pollPads() — [] unless hosting
  guestFrame:guestFrame,     // hooked into frame() — false unless guest
  // exposed for tools/test-net.mjs (and debugging)
  _encodeSnapshot:encodeSnapshot,
  _applySnapshot:applySnapshot,
  _sendSnapshot:sendSnapshot,
  _guests:guests,
  _events:ev,
  _stop:stop
};
})();
if(typeof window!=='undefined')window.NET=NET;
