// Local dev stand-in for server/worker.js — same protocol, same close codes,
// so the client can't tell the difference. One process serves many rooms.
//
//   cd tools && npm install && node relay-local.mjs   (ws://localhost:8787)
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const rooms = new Map(); // code -> {host, guests:Map<id,ws>, nextId}

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,8})$/);
  if (!m) { ws.close(4004, 'bad path'); return; }
  const code = m[1];
  const role = url.searchParams.get('role');
  let room = rooms.get(code);

  if (role === 'host') {
    if (room && room.host) { ws.close(4001, 'room already hosted'); return; }
    room = { host: ws, guests: new Map(), nextId: 1 };
    rooms.set(code, room);
    ws.send(JSON.stringify({ t: 'hosting' }));
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg.to !== undefined) {
          const g = room.guests.get(msg.to);
          if (g) g.send(data.toString());
          return;
        }
      }
      for (const g of room.guests.values()) g.send(data, { binary: isBinary });
    });
    ws.on('close', () => {
      for (const g of room.guests.values()) { try { g.close(4000, 'host left'); } catch {} }
      rooms.delete(code);
    });
  } else {
    if (!room || !room.host) { ws.close(4002, 'no such room'); return; }
    if (room.guests.size >= 3) { ws.close(4003, 'room full'); return; }
    const id = room.nextId++;
    room.guests.set(id, ws);
    ws.send(JSON.stringify({ t: 'welcome', id }));
    room.host.send(JSON.stringify({ t: 'join', id }));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      msg.from = id;
      room.host.send(JSON.stringify(msg));
    });
    ws.on('close', () => {
      if (room.guests.delete(id) && room.host)
        room.host.send(JSON.stringify({ t: 'leave', id }));
    });
  }
});
console.log('pixel-horde local relay on ws://localhost:' + PORT);
