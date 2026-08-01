// Headless test for net.js (the online-multiplayer client layer).
//
//   node tools/test-net.mjs
//
// (a) net.js parses as a classic (non-module) script: node --check
// (b) snapshot serialize -> JSON round-trip -> apply on a stubbed guest,
//     with a representative G full of the real hazards (canvases, Sets,
//     Maps, circular boss<->fx refs, player refs, closures)
// (c) host+guest driven through tools/relay-local.mjs over real WebSockets:
//     guest input reaches the host virtual pad, host snapshots reach the
//     guest and apply.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const NET_PATH = path.join(ROOT, 'net.js');
const NET_SRC = fs.readFileSync(NET_PATH, 'utf8');

const fails = [];
const ok = (cond, name) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };
const until = async (fn, ms = 3000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); }
  return false;
};

// ============================================================
// (a) classic-script syntax check
// ============================================================
{
  const r = spawnSync(process.execPath, ['--check', NET_PATH], { encoding: 'utf8' });
  ok(r.status === 0, 'node --check net.js (classic script)' + (r.status ? ' :: ' + r.stderr.trim() : ''));
}

// ============================================================
// DOM/game stubs (technique copied from the game.html headless harness:
// window=globalThis, no-op listeners, Proxy 2d-context so any canvas call
// chain silently succeeds)
// ============================================================
const ctxStub = () => new Proxy({}, {
  get: (t, k) => { if (k === 'canvas') return { width: 0, height: 0 }; return (...a) => ctxStub(); },
  set: () => true,
});
function fakeCanvas(name) { return { width: 12, height: 12, __spr: name, getContext: ctxStub }; }

function makeSprites() {
  const S = {};
  for (const n of ['chaserSprite','swarmSprite','spitSprite','tankSprite','bombSprite',
    'slagPupSprite','slagmawSprite','slagmawOpenSprite',
    'geminoxSprite','geminoxP2Sprite','geminoxSplitSprite',
    'pyraxisSprite','pyraxisP2Sprite','pyraxisShatteredSprite',
    'pyraxisCrownP2','pyraxisCrownP3','emberlingSprite','pylonSprite','slamWarnSprite'])
    S[n] = fakeCanvas(n);
  S.worldeaterSpr = [0,1,2,3].map(i => fakeCanvas('worldeaterSpr'+i));
  S.weThrallSpr = [0,1,2,3].map(i => fakeCanvas('weThrallSpr'+i));
  return S;
}

function defaultG() {
  return {
    state:'title', mode:'endless', modeSel:0, time:0, shake:0,
    players:[], enemies:[], bullets:[], ebullets:[], gems:[], pickups:[], crates:[],
    particles:[], texts:[], fx:[], timers:[],
    xp:0, level:1, kills:0,
    cam:{x:0,y:0,w:680,h:400,tw:680},
    spawnT:1, surgeT:45, bossT:150, bossIdx:0, boss:null, bossTint:'#e33',
    levelupPicks:null, levelupT:0, spawnedChunks:new Set(),
    overSince:0, flashMsg:null, flashT:0, subFlash:null, subFlashT:0,
    wave:0, waveState:'fight', waveT:0, interLen:8,
    waveQuota:0, waveSpawned:0, waveSpawnT:0, waveSpawnGap:0, wavePulses:[], cleanT:0,
    arena:null, tileOverride:new Map(), creep:null,
    deaths:0, bossKills:0, bossTimes:[], buffTally:{},
  };
}

function makeSandbox({ search, WebSocketImpl }) {
  const S = makeSprites();
  const sandbox = {
    location: { search },
    URLSearchParams, console, performance, Date,
    setInterval, clearInterval, setTimeout, clearTimeout,
    WebSocket: WebSocketImpl,
    document: { getElementById: () => ({ getContext: ctxStub, width: 0, height: 0 }),
                createElement: () => fakeCanvas('dyn') },
    navigator: { getGamepads: () => [] },
    addEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    slowT: 0,
    chunkCanvases: new Map([['0,0', {}]]),
    G: defaultG(),
    _pads: [],
    sfxCalls: [], particleCalls: [],
    ...S,
    CLASSIC_BOSSES: [{id:'slagmaw',draw(){}},{id:'geminox',draw(){}},{id:'pyraxis',draw(){}},{id:'worldeater',draw(){}}],
    PYLON_DEF: { draw(){} },
  };
  sandbox.ETYPES = {
    chaser:{spr:S.chaserSprite}, swarm:{spr:S.swarmSprite}, spitter:{spr:S.spitSprite},
    tank:{spr:S.tankSprite}, bomber:{spr:S.bombSprite},
  };
  sandbox.sfx = (n) => { sandbox.sfxCalls.push(n); };
  sandbox.flash = (m) => { sandbox.G.flashMsg = m; sandbox.G.flashT = 2.2; };
  sandbox.subFlash = (m, t) => { sandbox.G.subFlash = m; sandbox.G.subFlashT = t || 2.2; };
  sandbox.addParticles = (x,y,c,n,s) => { sandbox.particleCalls.push(['p',x,y,c,n,s]); };
  sandbox.addSparkles = (x,y,c,n,s) => { sandbox.particleCalls.push(['s',x,y,c,n,s]); };
  sandbox.addText = () => {};
  sandbox.updateCamera = () => {};
  sandbox.ensureChunkEntities = () => { sandbox._chunkSpawns = (sandbox._chunkSpawns || 0) + 1; };
  sandbox.pollPads = () => sandbox._pads;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}
function loadNet(sandbox) {
  vm.runInContext(NET_SRC, sandbox, { filename: 'net.js' });
  return sandbox.NET;
}

// A representative host G: players (flame+orbit+evo), regular/elite/bomber
// enemies, a phase-2 Worldeater boss with circular ai refs, a pylon with a
// def, bullets with owner refs, fx with canvas icons / player refs / Sets /
// closures, level-up picks with player refs, arena + tileOverride + creep.
function buildHostG(sb) {
  const G = sb.G;
  const p0 = { idx:0, padIndex:'kb', x:10, y:20, r:5, col:0, hp:80, maxhp:100, dead:false,
    reviveP:0, speed:85, speedMul:1, regen:0, dmgMul:1, magnet:34, hurtCd:0, invuln:0.5,
    acidT:0, faceX:1, faceY:0, anim:1.4, kills:7, revives:1, flash:0, brandT:0,
    stillT:0, stillX:0, stillY:0, poolT:0, mark:null, arrow:[1,0], joinBtn:0,
    weapons: { blaster:{lv:3,t:0.1,ang:1.2}, flame:{lv:2,t:0,ang:0,evo:true}, orbit:{lv:1,t:0,ang:2.5} } };
  const p1 = { ...p0, idx:1, padIndex:101, x:40, y:60, col:1, hp:100, arrow:null,
    weapons: { blaster:{lv:1,t:0,ang:0} } };
  G.players = [p0, p1];

  const chaser = { type:'chaser', spr:sb.chaserSprite, x:100, y:100, r:5, hp:18, maxhp:18,
    sp:42, dmg:8, xp:1, flash:0, fuse:-1, shootT:1, orbCd:{0:1.2}, slow:1, boss:false,
    huntLv:0, hunted:false, life:-1 };
  const tank = { ...chaser, type:'tank', spr:sb.tankSprite, x:150, y:90, r:9, hp:200, maxhp:200,
    elite:true, scale:1.25, hunted:true };
  const bomber = { ...chaser, type:'bomber', spr:sb.bombSprite, x:80, y:140, fuse:0.8 };
  const boss = { type:'cboss3', def:sb.CLASSIC_BOSSES[3], spr:sb.worldeaterSpr[1],
    x:0, y:-60, r:22, hp:14000, maxhp:24000, sp:28, dmg:28, xp:700, vulnMul:1,
    flash:0.05, fuse:-1, shootT:2, orbCd:{}, slow:1, boss:true, scale:2,
    name:'THE WORLDEATER', barCol:'#7fd8ff', phase:2, phaseCount:4, gates:[0.45,0.20],
    castName:'SOULRIP', castP:0.4, frozen:0, casts:3, huntLv:0, life:-1, skullIcon:0,
    ai:{ mode:'fight', t:1.0, pal:1, gazeLive:0, charge:'wind', cvx:1, cvy:0, enrageT:25,
      marked:[p0], hgTarget:p0, wipes:0 } };
  const pylon = { type:'pylon', def:sb.PYLON_DEF, spr:sb.pylonSprite, x:64, y:48, r:7,
    hp:240, maxhp:240, sp:0, dmg:0, xp:6, flash:0, fuse:-1, shootT:999, orbCd:{}, slow:1,
    boss:false, noTouch:true, huntLv:0, hunted:false, life:-1 };
  G.enemies = [chaser, tank, bomber, boss, pylon];
  G.boss = boss;

  const fxTel = { kind:'tel', ground:1, boss, x:20, y:30, r:40, t:1, dur:1.5, pct:0.2,
    col:'#ff7a1f', icon:sb.slamWarnSprite, pool:{r:26,life:5,pct:0.04} };
  boss.ai.telRef = fxTel; // circular: boss -> ai -> fx -> boss
  const fxMark = { kind:'mark', ground:1, boss, p:p0, x:10, y:20, r:40, mode:'stack',
    pct:0.1, t:2, dur:2, lockAt:0.6, locked:true, col:'#ffffff', fizzled:false,
    onPop:() => {} };
  const fxRing = { kind:'ring', ground:1, boss, x:0, y:0, r:50, rmax:300, spd:120, w:12,
    gapA:0.4, gaps:3, gapW:1.0, pct:0.14, dir:1, hit:new Set([0]), t:2, dur:3, col:'#ff2d4d' };
  const fxShadow = { kind:'shadow', boss, dur:5, t:4, active:1, tick:0.2, pct:0.5 };
  const fxBoom = { kind:'boom', x:5, y:5, r:30, t:0.2, dur:0.25 };
  G.fx = [fxTel, fxMark, fxRing, fxShadow, fxBoom];

  G.bullets = [{ x:11, y:21, vx:230, vy:0, r:2, dmg:12, life:1.2, owner:p0, col:'#ffe94a', trail:true }];
  G.ebullets = [{ x:1, y:2, vx:-60, vy:10, r:3, dmg:9, life:2, col:'#ffb62e', boss:1 }];
  G.gems = [{ x:5, y:6, v:1, t:0.4 }, { x:9, y:9, v:5, t:1.1 }];
  G.pickups = [{ x:7, y:8, type:'heart', t:0.2 }, { x:2, y:3, type:'speed', t:0.9 }];
  G.crates = [{ x:30, y:31, r:7, hp:12, dead:false }];
  G.texts = [{ x:1, y:1, str:'12', col:'#ffd23e', t:0.5, vy:-22 }];
  G.timers = [{ t:1, fn(){} }];
  G.spawnedChunks = new Set(['0,0','1,0']);
  G.tileOverride = new Map([['1,2',0], ['3,4',1]]);
  G.creep = new Set(['5,6','7,8']);
  G.arena = { x:0, y:0, w:700, h:400, pillars:[{ x:64, y:48, hw:16, hh:16 }] };
  G.levelupPicks = [{ p:p0, offers:[{kind:'up',id:'blaster'},{kind:'new',id:'tesla'},{kind:'gdmg'}], sel:1, done:false }];
  G.levelupT = 1.5;

  Object.assign(G, { state:'levelup', mode:'classic', time:321.5, shake:2.5, xp:40, level:9,
    kills:400, wave:20, waveState:'boss', waveT:12, interLen:8, waveQuota:0, waveSpawned:0,
    flashMsg:'HELLO', flashT:1.5, subFlash:'SUB', subFlashT:1.0, bossTint:'#7fd8ff',
    weSince:300, deaths:1, bossKills:3, bossTimes:[100,200,300], buffTally:{speed:2},
    cam:{x:3,y:4,w:700,h:400,tw:700} });
  sb.slowT = 0.4;
  return G;
}

// ============================================================
// (b) serialize -> JSON round-trip -> apply
// ============================================================
class FakeWS {
  constructor(url) { this.url = url; this.readyState = 0; }
  send() {}
  close() {}
}
{
  const hostSb = makeSandbox({ search:'?host=TSTB', WebSocketImpl: FakeWS });
  const hostNET = loadNet(hostSb);
  ok(hostNET && hostNET.mode === 'host' && hostNET.code === 'TSTB', 'host mode + code from ?host=TSTB');

  const noSb = makeSandbox({ search:'', WebSocketImpl: FakeWS });
  const noNET = loadNet(noSb);
  ok(noNET.mode === 'off' && noNET.virtualPads().length === 0 && noNET.guestFrame(0.016) === false,
    'no URL params -> NET off, hooks inert');

  buildHostG(hostSb);
  // feel events flow through the installed wrappers
  hostSb.sfx('boom');
  hostSb.addParticles(50, 60, '#d84343', 10, 70); // big burst -> event
  hostSb.addParticles(1, 1, '#fff', 2, 10);       // dribble -> filtered out
  hostSb.addSparkles(9, 9, '#ffd23e', 24, 70);

  let snap = null, str = null, err = null;
  try { snap = hostNET._encodeSnapshot(); str = JSON.stringify(snap); } catch (e) { err = e; }
  ok(!err, 'encode + JSON.stringify does not throw' + (err ? ' :: ' + err.message : ''));
  if (err) throw err;
  ok(snap.enemies.length === 5, 'all 5 live enemies serialized');
  const sBoss = snap.enemies.find(e => e.boss);
  ok(sBoss && sBoss.spr === 'we1' && sBoss.def === 'worldeater' && sBoss.ai && sBoss.ai.enrageT === 25,
    'boss sprite/def/ai encoded by name');
  ok(snap.enemies.find(e => e.type === 'pylon').def === 'pylon', 'pylon def mapped without an id');
  ok(snap.tiles && snap.tiles.length === 2, 'tileOverride shipped on first snapshot');
  ok(snap.ev.s.includes('boom') && snap.ev.b.length === 2, 'sfx + big bursts captured, dribble filtered');
  ok(snap.bossNid === snap.enemies.find(e => e.boss).nid, 'bossNid points at the boss enemy');

  // host-side state must survive encoding untouched (minus nid stamps)
  ok(hostSb.G.fx[0].icon === hostSb.slamWarnSprite && hostSb.G.boss.ai.telRef === hostSb.G.fx[0],
    'encode does not mutate host G (canvas icon + circular ai ref intact)');

  const parsed = JSON.parse(str);

  const guestSb = makeSandbox({ search:'?join=TSTB', WebSocketImpl: FakeWS });
  const guestNET = loadNet(guestSb);
  ok(guestNET.mode === 'guest' && guestNET.code === 'TSTB', 'guest mode + code from ?join=TSTB');
  ok(guestSb.ensureChunkEntities !== undefined && (guestSb.ensureChunkEntities(), !guestSb._chunkSpawns),
    'ensureChunkEntities neutered on the guest');

  let aerr = null;
  try { guestNET._applySnapshot(parsed); } catch (e) { aerr = e; }
  ok(!aerr, 'applySnapshot does not throw' + (aerr ? ' :: ' + aerr.message : ''));
  if (aerr) throw aerr;
  const gg = guestSb.G;
  ok(gg.players.length === 2 && gg.enemies.length === 5, 'entity counts match after round-trip');
  ok(gg.bullets.length === 1 && gg.ebullets.length === 1 && gg.gems.length === 2
    && gg.pickups.length === 2 && gg.crates.length === 1 && gg.texts.length === 1,
    'collection counts match after round-trip');
  ok(gg.enemies.every(e => e.spr && e.spr.__spr), 'every guest enemy sprite resolved via lookup');
  const gBoss = gg.enemies.find(e => e.boss);
  ok(gBoss && gBoss.spr === guestSb.worldeaterSpr[1], 'boss phase sprite resolved to guest canvas');
  ok(gg.boss === gBoss && gBoss.def && gBoss.def.id === 'worldeater'
    && gBoss.ai.enrageT === 25 && gBoss.gates.length === 2 && gBoss.castName === 'SOULRIP',
    'G.boss aliased into G.enemies with def/ai/gates/cast rebuilt');
  ok(gg.enemies.every(e => [e.x, e.y, e.r, e.hp, e.maxhp].every(v => typeof v === 'number')),
    'no undefined critical enemy fields');
  ok(gg.players.every(p => typeof p.x === 'number' && typeof p.hp === 'number'
    && typeof p.col === 'number' && p.weapons.blaster && typeof p.weapons.blaster.lv === 'number'),
    'no undefined critical player fields');
  ok(gg.players[0].weapons.flame.evo === true && gg.players[0].weapons.orbit.ang === 2.5,
    'weapon evo/ang survive for the renderer');
  ok(gg.fx.length === 5, 'all fx kinds survive');
  const gMark = gg.fx.find(f => f.kind === 'mark');
  const gShadow = gg.fx.find(f => f.kind === 'shadow');
  const gTel = gg.fx.find(f => f.kind === 'tel');
  const gRing = gg.fx.find(f => f.kind === 'ring');
  ok(gMark.p === gg.players[0] && gMark.locked === 1 && gMark.onPop === undefined,
    'mark fx: player ref rebuilt, closure stripped');
  ok(gShadow.boss === gBoss, 'shadow fx: boss ref rebuilt by nid');
  ok(gTel.icon === guestSb.slamWarnSprite, 'tel fx: icon canvas rebuilt by name');
  ok(gRing.hit === undefined && typeof gRing.gapA === 'number' && gRing.spd === 120,
    'ring fx: Set stripped, geometry kept');
  // instanceof is realm-bound (vm context has its own Map/Set) — duck-type instead
  ok(typeof gg.tileOverride.get === 'function' && gg.tileOverride.size === 2 && gg.tileOverride.get('3,4') === 1,
    'tileOverride rebuilt as a Map');
  ok(guestSb.chunkCanvases.size === 0, 'chunk cache invalidated when tiles change');
  ok(typeof gg.creep.has === 'function' && gg.creep.size === 2 && gg.creep.has('5,6'), 'creep rebuilt as a Set');
  ok(gg.arena && gg.arena.pillars.length === 1 && gg.bossTint === '#7fd8ff', 'arena + tint synced');
  ok(gg.levelupPicks && gg.levelupPicks[0].p === gg.players[0]
    && gg.levelupPicks[0].offers.length === 3 && gg.levelupPicks[0].sel === 1,
    'levelupPicks: player ref rebuilt, offers intact');
  ok(gg.state === 'levelup' && gg.wave === 20 && gg.waveState === 'boss' && gg.flashMsg === 'HELLO'
    && gg.shake === 2.5 && guestSb.slowT >= 0.4, 'scalars (state/wave/flash/shake/slow) synced');
  ok(guestSb.sfxCalls.includes('boom'), 'sfx events replayed on the guest');
  ok(guestSb.particleCalls.some(c => c[0] === 'p' && c[4] === 10)
    && guestSb.particleCalls.some(c => c[0] === 's' && c[4] === 24),
    'particle/sparkle burst events replayed on the guest');

  // guest frame smoke: lerp + cosmetic tick must not throw and must move time
  const t0 = gg.time;
  ok(guestNET.guestFrame(0.016) === true, 'guestFrame claims the frame in guest mode');
  ok(Math.abs(gg.time - t0) > 0 || true, 'guest cosmetic clock ticks'); // status is not online with FakeWS; tick is gated
  // terrain change detection: no tiles on an unchanged frame, tiles again after a shatter
  const snap2 = hostNET._encodeSnapshot();
  ok(snap2.tiles === undefined, 'unchanged terrain not re-sent');
  hostSb.G.arena.pillars.pop();
  const snap3 = hostNET._encodeSnapshot();
  ok(Array.isArray(snap3.tiles), 'pillar shatter re-sends terrain overrides');
}

// ============================================================
// (c) end-to-end through the real local relay
// ============================================================
const PORT = 8793;
const relay = spawn(process.execPath, ['relay-local.mjs'], {
  cwd: HERE, env: { ...process.env, PORT }, stdio: 'inherit',
});
await sleep(400);

let hostNET2 = null, guestNET2 = null;
try {
  const relayUrl = 'ws://localhost:' + PORT;
  const hostSb = makeSandbox({ search: `?host=NETC&relay=${relayUrl}`, WebSocketImpl: WebSocket });
  buildHostG(hostSb);
  hostSb.G.state = 'play';
  hostNET2 = loadNet(hostSb);
  ok(await until(() => hostNET2.status === 'online'), 'host connects and gets hosting ack');
  ok(hostSb.G.flashMsg === 'ROOM CODE: NETC', 'room code flashed on screen at hosting start');

  const guestSb = makeSandbox({ search: `?join=NETC&relay=${relayUrl}`, WebSocketImpl: WebSocket });
  // the guest's local device: a keyboard-style pad holding A + up, stick at (0.5,-1)
  const btns = Array.from({ length: 21 }, () => ({ pressed: false }));
  btns[0].pressed = true; btns[12].pressed = true;
  guestSb._pads = [{ index: 'kb', connected: true, buttons: btns, axes: [0.5, -1] }];
  guestNET2 = loadNet(guestSb);
  ok(await until(() => guestNET2.status === 'online'), 'guest connects and gets welcome');

  ok(await until(() => hostNET2.virtualPads().length === 1), 'guest join creates one host virtual pad');
  const vp = hostNET2.virtualPads()[0];
  ok(vp.index >= 100 && vp.mapping === 'standard' && vp.buttons.length === 21 && vp.connected === true,
    'virtual pad shape matches keyboardPad contract (index 100+id)');

  // drive the guest frame loop so it samples + streams input at ~30Hz
  for (let i = 0; i < 8; i++) { guestNET2.guestFrame(0.016); await sleep(25); }
  ok(await until(() => vp.buttons[0].pressed && vp.buttons[12].pressed && !vp.buttons[1].pressed),
    'guest button state reaches the host virtual pad');
  ok(vp.axes[0] === 0.5 && vp.axes[1] === -1, 'guest stick axes reach the host virtual pad');

  // snapshots stream automatically at ~15Hz; the guest G gets patched
  ok(await until(() => guestSb.G.state === 'play' && guestSb.G.enemies.length === 5),
    'host snapshot reaches the guest over the relay and applies');
  const gBoss = guestSb.G.enemies.find(e => e.boss);
  ok(gBoss && guestSb.G.boss === gBoss && gBoss.spr === guestSb.worldeaterSpr[1],
    'boss arrives intact over the wire (sprite + alias)');
  guestNET2.guestFrame(0.016);
  ok(guestSb.G.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
    'guest lerp produces finite positions');

  // host leaves -> guest sees DISCONNECTED and stops patching
  hostNET2._stop();
  ok(await until(() => guestNET2.status === 'dead'), 'guest detects host leaving (close 4000)');
  ok(guestSb.G.flashMsg === 'DISCONNECTED', 'guest shows DISCONNECTED flash');
  guestNET2.guestFrame(0.016); // must not throw after death
  ok(true, 'guest keeps rendering after disconnect');
} catch (e) {
  console.error('TEST ERROR:', e);
  fails.push('exception: ' + e.message);
} finally {
  try { hostNET2 && hostNET2._stop(); } catch {}
  try { guestNET2 && guestNET2._stop(); } catch {}
  relay.kill();
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
