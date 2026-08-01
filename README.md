# PIXEL HORDE

Couch co-op pixel survival for 1–4 gamepads (keyboard plays as one more pad).
Single self-contained HTML file — no build, no assets, no dependencies.

**Play:** https://dsusviela.github.io/pixel-horde/ — or open `index.html` locally in Chrome/Edge.

- **CLASSIC** — 20 waves, 4 phased raid bosses. Clear wave 20 to win.
- **ENDLESS** — survive as the clock ramps the horde.

Keyboard: WASD/arrows move, SPACE = (A), ESC = START. Gamepads: press any
button so the browser detects the pad, then (A) to join. Drop-in mid-run is
supported.

## Repo layout

- `index.html` — the whole game.
- `server/` — Cloudflare Worker relay for online multiplayer (in progress).
- `tools/` — local dev relay + headless protocol tests.

## Online multiplayer (work in progress)

Host-authoritative over WebSockets: the host browser runs the simulation,
guests send gamepad input and render streamed snapshots. The relay is a dumb
room server (Cloudflare Durable Object) — no game logic server-side.
