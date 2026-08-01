// PIXEL HORDE relay — Cloudflare Worker + Durable Object.
//
// A dumb room relay: no game logic lives here. One Room DO per room code.
// The first socket connecting with role=host claims the room; guests join
// after. Guests' messages are forwarded to the host tagged with their id;
// everything the host sends is broadcast to every guest (binary snapshots
// pass through untouched). When the host drops, the room closes.
//
// Deploy:  cd server && npx wrangler deploy
// Client:  wss://<worker>.<account>.workers.dev/ws/<CODE>?role=host|guest

export class Room {
  constructor(state, env) {
    this.state = state;
    this.host = null;
    this.guests = new Map(); // id -> WebSocket
    this.nextId = 1;
  }

  fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });

    const role = url.searchParams.get('role');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (role === 'host') this.attachHost(server);
    else this.attachGuest(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  attachHost(ws) {
    if (this.host) { ws.close(4001, 'room already hosted'); return; }
    this.host = ws;
    ws.send(JSON.stringify({ t: 'hosting' }));
    ws.addEventListener('message', (ev) => {
      // host → all guests. Binary = snapshot, JSON = control; both broadcast
      // except targeted control frames {to:id,...}.
      if (typeof ev.data === 'string') {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.to !== undefined) {
          const g = this.guests.get(msg.to);
          if (g) this.safeSend(g, ev.data);
          return;
        }
      }
      for (const g of this.guests.values()) this.safeSend(g, ev.data);
    });
    const bye = () => this.closeRoom();
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  attachGuest(ws) {
    if (!this.host) { ws.close(4002, 'no such room'); return; }
    if (this.guests.size >= 3) { ws.close(4003, 'room full'); return; }
    const id = this.nextId++;
    this.guests.set(id, ws);
    ws.send(JSON.stringify({ t: 'welcome', id }));
    this.safeSend(this.host, JSON.stringify({ t: 'join', id }));
    ws.addEventListener('message', (ev) => {
      // guest → host only. JSON frames get the sender id stamped on; a guest
      // can never impersonate another (id comes from us, not the payload).
      if (typeof ev.data !== 'string') return; // guests send JSON only
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      msg.from = id;
      this.safeSend(this.host, JSON.stringify(msg));
    });
    const bye = () => {
      if (this.guests.delete(id))
        this.safeSend(this.host, JSON.stringify({ t: 'leave', id }));
    };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  closeRoom() {
    this.host = null;
    for (const g of this.guests.values()) {
      try { g.close(4000, 'host left'); } catch {}
    }
    this.guests.clear();
  }

  safeSend(ws, data) {
    try { ws.send(data); } catch {}
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,8})$/);
    if (m) {
      const room = env.ROOM.get(env.ROOM.idFromName(m[1]));
      return room.fetch(request);
    }
    if (url.pathname === '/health') return new Response('ok');
    return new Response('PIXEL HORDE relay', { status: 200 });
  }
};
