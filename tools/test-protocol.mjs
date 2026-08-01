// Headless protocol test: spins up the local relay, then drives a fake host
// and two fake guests through the full lifecycle. Exits 0 on success.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8791;
const relay = spawn(process.execPath, ['relay-local.mjs'], {
  cwd: dirname(fileURLToPath(import.meta.url)),
  env: { ...process.env, PORT }, stdio: 'inherit',
});
await sleep(400);

const url = (code, role) => `ws://localhost:${PORT}/ws/${code}?role=${role}`;
const fails = [];
const ok = (cond, name) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };

function connect(u) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(u);
    ws.binaryType = 'arraybuffer';
    ws.inbox = [];
    ws.closed = null;
    ws.onmessage = (e) => ws.inbox.push(e.data);
    ws.onclose = (e) => { ws.closed = { code: e.code, reason: e.reason }; };
    ws.onopen = () => res(ws);
    ws.onerror = () => rej(new Error('connect failed ' + u));
  });
}
const nextMsg = async (ws, pred, ms = 1500) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const i = ws.inbox.findIndex(pred);
    if (i >= 0) return ws.inbox.splice(i, 1)[0];
    await sleep(20);
  }
  return null;
};
const json = (pred) => (d) => { if (typeof d !== 'string') return false; try { return pred(JSON.parse(d)); } catch { return false; } };

try {
  // guest before host -> rejected with 4002
  const early = await connect(url('ABCD', 'guest'));
  await sleep(200);
  ok(early.closed && early.closed.code === 4002, 'guest without host rejected (4002)');

  const host = await connect(url('ABCD', 'host'));
  ok(await nextMsg(host, json((m) => m.t === 'hosting')), 'host gets hosting ack');

  // second host -> rejected 4001
  const host2 = await connect(url('ABCD', 'host'));
  await sleep(200);
  ok(host2.closed && host2.closed.code === 4001, 'second host rejected (4001)');

  const g1 = await connect(url('ABCD', 'guest'));
  const w1 = await nextMsg(g1, json((m) => m.t === 'welcome'));
  ok(w1, 'guest1 welcomed');
  const id1 = JSON.parse(w1).id;
  ok(await nextMsg(host, json((m) => m.t === 'join' && m.id === id1)), 'host notified of guest1 join');

  const g2 = await connect(url('ABCD', 'guest'));
  const id2 = JSON.parse(await nextMsg(g2, json((m) => m.t === 'welcome'))).id;
  await nextMsg(host, json((m) => m.t === 'join' && m.id === id2));
  ok(id1 !== id2, 'guest ids unique');

  // input routing: guest -> host, stamped with from-id, no spoofing
  g1.send(JSON.stringify({ t: 'input', ax: 0.5, ay: -1, b: 3, from: 999 }));
  const inp = await nextMsg(host, json((m) => m.t === 'input'));
  ok(inp && JSON.parse(inp).from === id1 && JSON.parse(inp).ax === 0.5, 'input routed host-ward with server-stamped id');

  // snapshot broadcast: host binary -> all guests, host JSON w/o "to" -> all
  host.send(new Uint8Array([1, 2, 3, 4]).buffer);
  const s1 = await nextMsg(g1, (d) => typeof d !== 'string');
  const s2 = await nextMsg(g2, (d) => typeof d !== 'string');
  ok(s1 && s2 && new Uint8Array(s1).length === 4, 'binary snapshot broadcast to every guest');

  // targeted control frame: only guest2 sees it
  host.send(JSON.stringify({ t: 'kick', to: id2 }));
  ok(await nextMsg(g2, json((m) => m.t === 'kick')), 'targeted frame reaches its guest');
  ok(!(await nextMsg(g1, json((m) => m.t === 'kick'), 400)), 'targeted frame skips other guests');

  // room full: 3 guests max
  const g3 = await connect(url('ABCD', 'guest'));
  await nextMsg(g3, json((m) => m.t === 'welcome'));
  const g4 = await connect(url('ABCD', 'guest'));
  await sleep(200);
  ok(g4.closed && g4.closed.code === 4003, '4th guest rejected (4003 room full)');

  // leave notification
  g2.close();
  ok(await nextMsg(host, json((m) => m.t === 'leave' && m.id === id2)), 'host notified of guest leave');

  // host leaves -> room closes for guests with 4000
  host.close();
  await sleep(300);
  ok(g1.closed && g1.closed.code === 4000, 'guests closed when host leaves (4000)');

  // room reusable after close
  const hostB = await connect(url('ABCD', 'host'));
  ok(await nextMsg(hostB, json((m) => m.t === 'hosting')), 'room code reusable after host left');
  hostB.close();
} catch (e) {
  console.error('TEST ERROR:', e.message);
  fails.push('exception');
}

relay.kill();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
