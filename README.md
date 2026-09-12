# PIXEL HORDE

Couch co-op pixel survival for 1–4 gamepads (keyboard plays as one more pad).
Single self-contained HTML file — no build, no assets, no dependencies.

**Play:** https://dsusviela.github.io/pixel-horde/ — or open `index.html` locally in Chrome/Edge.

- **CLASSIC** — 20 waves, 3 phased raid bosses. Clear wave 20 to win.
- **ENDLESS** — survive as the clock ramps the horde.
- **BOSS RUSH** — 24 raid bosses back to back, no trash. The four tier
  capstones (Slagmaw, Geminox, Pyraxis, the Worldeater) drop their signature
  spell for the party; levels/charms are paid out between fights instead of
  farmed. Boss hp is derived from the party's measured damage on the previous
  kill, targeting ~3-minute fights early and ~5 for the capstones, and boss
  damage reads as a percentage of the party's max hp — idling is lethal.

Keyboard: WASD/arrows move, SPACE = (A), ESC = START. Gamepads: press any
button so the browser detects the pad, then (A) to join. Drop-in mid-run is
supported. Hold BACK+START (keyboard: Backspace+Escape) for one second to
reload the page with a cache-busting query and pick up a fresh deploy.

## Repo layout

- `index.html` — the whole game. Since 2026-09-12 it carries the same renderer
  and art as the playground (density 2, light layer, ground v2, hand-drawn
  horde/fauna/Slagmaw, Ninja Adventure hero and pickups); only the lab-only
  gameplay (event patterns, soft transitions, the 10-wave table, the silent
  heart/regen tuning) stays in the playground.
- `playground.html` — isolated 10-wave event lab with timed soft transitions,
  survivor carryover, six movement-only opportunities, and a Slagmaw finale.
  Wave 7 is THE CRYSTAL MAZE (2026-09-12): the floor around the party rises as
  breakable crystal shards with thin noise-carved corridors, every shot is spent
  on the shard it hits, a broken shard pays a gem, and the wave's ghosts drift
  through crystal and rock (`tools/art/ghost.mjs`, `tools/art/crystal.mjs`).
  Sprite work lands here first (`tools/art/land.mjs`), then is ported to
  `index.html` as a hunk-filtered diff of the two files.
- `net.js` — online multiplayer client layer (inert unless activated by URL).
- `server/` — Cloudflare Worker relay for online multiplayer.
- `tools/` — local dev relay + headless protocol/net/game tests.

## Rendering (visual revamp)

`index.html` and `playground.html` render at density 2 (two buffer pixels per world unit) with a
light layer composited once per frame. Nothing gameplay-facing changed: a world
unit is what a buffer pixel used to be, sprites carry a `den` tag, and
`makeSprite(rows,pal,2)` art fills the same world box its 1x predecessor did.

URL flags: `?zoom=1.8` (free-camera zoom, default 1.8; `?zoom=1` is the
pre-2026-09-12 framing, boss arenas keep their own window), `?density=1` (old raster, new art), `?light=0` (no light layer),
`?lite` (light off, half-res light canvas, no sub-unit motion), `?crisp`
(nearest blit even when downsampling), `?auto=0` (disable the safety valve),
`?perf` (HUD with Canvas2D call counters, light stamps and the current density).
Safety valve: when the draw-time EMA sits above 14 ms for 3 s the density drops to
1 for the rest of the session (the HUD shows `den 1 auto`).

Budget on a modest laptop (Intel UHD-class, 1080p): draw <= 8 ms median /
12 ms p90, zero > 20 ms frames over 5 s at waves 8-10 with 4 full kits.
Headless gates (`cd tools && npm run gates`): `test-playground.mjs` reaches
victory at 1/2/4 players; `perf-stress.mjs` p95 <= 15,000 Canvas2D calls per
frame (300 enemies, lava river, 4 kits); `perf-calls.mjs` p95 <= 4,000.
The game itself is covered by the headless suite (`node tools/test-modes.mjs`,
`test-rush`, `test-schools`, `test-terrain`, `test-slagmaw`, `test-draft-timeout`,
`test-protocol`, `test-net`), which boots `index.html` through `tools/headless.mjs`;
`tools/frame.mjs --file index.html --wave N` renders a live game frame.
Art tooling: `tools/sheet.mjs` (sprite sheets, chunk bakes, light canvas),
`tools/frame.mjs` (a live frame through the real `render()`),
`tools/fillrate.html` (in-browser blit/composite cost). The per-family art
checklist is the comment block above `MAT` in `playground.html`.
Sprite craft (`cd tools && npm run art:<tool> -- ...`, all zero-dep):
`art/preview.mjs` (grid preview on both grounds + the 1x read + legend + frame
strip, rows printed beside it), `art/lint.mjs` (ragged rows, palette letters,
colour budget, orphans, banding, outline, ground contrast, frame IoU/drift),
`art/ramp.mjs` (hue-shifted OKLCH ramps as MAT objects, Lospec fetch, MAT
swatches) and `art/trace.mjs` (reference PNG to rows against a palette, texel
scale auto-detected). The drawing workflow and the 63 craft rules live in
`.claude/skills/pixel-art/` (loaded by Claude Code before sprite work).

Ninja Adventure port: the surface ground, props, horde, volcano fauna, pickups
and the eight hero characters come from the CC0 Ninja Adventure pack
(Pixel-boy) through the art module `tools/art/ninja.mjs`, inlined into
`playground.html` as one base64 atlas (`tools/art/ninja-atlas.png`, built by
`tools/art/build-ninja-atlas.mjs` from the Superpowers GitHub mirror). Atlas
sprites are den-2 canvases like `makeSprite` art; walk sheets carry
`.frames[dir][frame]` and `mobFrame`/`sheetFrame` pick the facing. Preview a
module without landing it with `tools/frame.mjs --inject`, land it with
`node tools/art/land.mjs tools/art/ninja.mjs`. Bosses, pups, overlays, VFX and
the volcano ground stay hand-drawn.

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

CLASSIC's first ten waves are one Slagmaw raid built on the survivor loop.
WAVE 1 CLEAR grants the PATH pick (destruction / illusion / necromancy) and
immediately walks the party down into the volcano. Waves 2-9 are an escalating
run of Survivors-style opportunities: THE RED HARVEST, THE GOLD RUSH, THE
SMASHERS, THE BAND, THE OFFERING, THE CINDER VENTS, THE SLAGSTORM, and THE
SLAG AUGUR. They progress from one volcanic threat at a time to combinations,
while changing which targets and routes pay the most XP. Movement is also
target selection: getting close focuses auto-fire, so choosing a farm route is
the combat input. Slaughterhulk remains in BOSS RUSH instead of interrupting
this arc. Counts in waves 1-10 are authored, not dps-scaled, and sized so an
active party clears late while an idle one is buried. Wave 10 is SLAGMAW: three
phases, the cracked cauldron, and the kill walks everyone back up. Waves
11-19 keep the full terrain-wave roster (band, stonefall, wards, dance,
swarm, creep, collapse) ahead of PYRAXIS at 15 and the WORLDEATER at 20;
GEMINOX now lives only in BOSS RUSH.

Tests: `node tools/test-protocol.mjs` (relay protocol), `node tools/test-net.mjs`
(net.js serialization + end-to-end over the relay), `node tools/test-rush.mjs
[seed]` (a full headless BOSS RUSH clear), `node tools/test-modes.mjs`
(CLASSIC/ENDLESS smoke + every screen in both languages), `node
tools/test-terrain.mjs` (every wave pattern, 1 and 3 players) and `node
tools/test-slagmaw.mjs` (the whole Slagmaw arc at 1/2/3/4 players, descent to ascent). The game itself runs
headless via `tools/headless.mjs`, which boots `index.html` in a vm with stub
canvas/audio and a seeded RNG.
