# PIXEL HORDE

Couch co-op pixel survival for 1–4 gamepads (keyboard plays as one more pad).
Single self-contained HTML file — no build, no assets, no dependencies.

**Play:** https://dsusviela.github.io/pixel-horde/ — or open `index.html` locally in Chrome/Edge.

- **CLASSIC** — 20 waves, 4 phased raid bosses. Clear wave 20 to win.
- **ENDLESS** — survive as the clock ramps the horde.
- **BOSS RUSH** — 24 raid bosses back to back, no trash. The four tier
  capstones (Slagmaw, Geminox, Pyraxis, the Worldeater) drop their signature
  spell for the party; levels/charms are paid out between fights instead of
  farmed. Boss hp is derived from the party's measured damage on the previous
  kill, targeting ~3-minute fights early and ~5 for the capstones, and boss
  damage reads as a percentage of the party's max hp — idling is lethal.

Keyboard: WASD/arrows move, SPACE = (A), ESC = START. Gamepads: press any
button so the browser detects the pad, then (A) to join. Drop-in mid-run is
supported.

## Repo layout

- `index.html` — the whole game.
- `net.js` — online multiplayer client layer (inert unless activated by URL).
- `server/` — Cloudflare Worker relay for online multiplayer.
- `tools/` — local dev relay + headless protocol/net/game tests.

## Online multiplayer

Host-authoritative over WebSockets: the host browser runs the simulation,
guests send gamepad input and render streamed snapshots (~15Hz). The relay is
a dumb room server (Cloudflare Durable Object) — no game logic server-side.
With no URL params the game is exactly the offline couch co-op build.

**Host a room** — open the game with `?host`:

    index.html?host            generates a 4-letter room code (shown on screen
                               and logged to the devtools console)
    index.html?host=ABCD       host with a code of your choosing (4-8 chars A-Z 0-9)

**Join a friend** — open the game with their code:

    index.html?join=ABCD

Each guest shows up on the host as one more gamepad (max 3 guests, 4 players
total) — join, pick a color, drop in mid-run, choose level-up boons, all with
your local keyboard or controller. Guests never simulate: they render the
host's snapshots, so the host's connection is the room.

**Relay server** — served over the web (GitHub Pages) the game defaults to
the deployed worker `wss://pixel-horde-relay.dsusviela.workers.dev`; opened
from disk or localhost it defaults to the dev relay `ws://localhost:8787`
(`cd tools && npm install && node relay-local.mjs`). Override per-URL with
`?relay=wss://...`, or page-globally with `window.PH_RELAY='wss://...'`
before `net.js` loads. Redeploy the worker with `cd server && npx wrangler
deploy`.

v1 limitations: no reconnect (a dropped guest re-joins by reloading; if the
relay drops, the host keeps playing solo), JSON snapshots (fine on a LAN or
decent broadband), guest-side interpolation only (no prediction).

## Boss roster

The BOSS RUSH order climbs from single-mechanic checks to the full encounters:

    SLAUGHTERHULK  ROTGRUB  STONEFATHER  EMBERWYRM  VOLTHARN  SLAGMAW
    HIVELORD  GEARWRIGHT XI  ARCANOMAGUS  THE TALLYMAN  RIMEFANG  GEMINOX
    THE UNBLINKING  DOOMBRINGER  EARTHBREAKER  WYRMTIDE  PRISMWARDEN  PYRAXIS
    STARCALLER  FROSTBOUND LICH  WARDEN OF ASH  THE PALE KING  BLADEDANCER
    THE WORLDEATER

Each is a two- or three-phase fight built from raid-genre mechanic primitives —
a lane dance, a polarity check, a soak, a shielded burn, a snatch-and-carry —
assembled out of the shared mechanic helpers in `index.html` (`pushSweep`,
`pushLine`, `pushCone`, `pushWander`, `pushEdge`, `pushPole`, `prisonPlayer`,
`shieldBoss`). All text is English/Spanish.

Tests: `node tools/test-protocol.mjs` (relay protocol), `node tools/test-net.mjs`
(net.js serialization + end-to-end over the relay), `node tools/test-rush.mjs
[seed]` (a full headless BOSS RUSH clear) and `node tools/test-modes.mjs`
(CLASSIC/ENDLESS smoke + every screen in both languages). The game itself runs
headless via `tools/headless.mjs`, which boots `index.html` in a vm with stub
canvas/audio and a seeded RNG.
