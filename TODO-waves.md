# Wave variety — requirements & status

## Done (v3 — THE RAID, 2026-08-31)
- [x] Waves 1-10 restructured as a WoW dungeon: surface trash + stat elites (1-4),
      mini-boss check SLAUGHTERHULK at 5 (now in CLASSIC_BOSSES; GEMINOX is rush-only,
      code untouched), descent, volcano block 6-9, SLAGMAW at 10, ascent. Waves 11-19
      keep the whole terrain-wave roster unchanged (nothing erased — creep, band,
      collapse, swarm, stonefall, wards, dance all still slotted; `lavamix` and
      `pressure` pattern code benched and handy).
- [x] Volcano block, one lesson per wave, all colour-grammar (VOLC): w6 fire-slug
      trails (red), w7 BURSTER v2 — the knockback is an ATTACK (rush, plant, 0.9s gold
      swell, pop+shove, dies; killed early it just dies, no pop, loot only on an early
      kill), w8 THE OFFERING with smashers in the pull, w9 THE SLAG AUGUR: a rooted
      caster mini-boss running Slagmaw's P2 rites (cinder ring / ember brand / inward
      ring) — both formerly-untaught mechanics now have a named teacher. Kill = bonus
      fountain, 85% = it sinks.
- [x] Pattern-less lesson waves carry `obj:[text,col]` (standing HUD objective) and pay
      their `lv.b` budget through the drip (`G.dripBonus`), same construction as xpPool.
- [x] dpsFactor authored zone extended to waves 1-10; prices: hulk hpClassic 4500,
      slagmaw 20000 (probe-checked), CLASSIC_TTK [70,120,135,150].

## Open (v3)
- [ ] Playtest: does the trash→elite→mini-boss→boss rhythm read; is the 6-9
      "slightly behind" pressure right (fights end at ~80-90% of timer by design);
      does the augur survive long enough vs 4p focus (AUGUR_HP 900)
- [ ] Boss prices: 2p runs long on both hulk and slagmaw (the (4n-1)/3 party
      multiplier is steeper than 2-bot dps — bot artifact in part); re-solve with
      balance-model progress once real parties play
- [ ] Surface elites are plain stat champions; consider a named surface elite pack


Design rule (the fix for v1): a wave's intended play must be the ONLY
HP-safe play AND the fastest XP. Never a suggestion the farm can overrule.
Every trash pattern rehearses a boss floor with the boss's own primitives.

Tests: `cd tools && node test-terrain.mjs` (every pattern, 1 and 3 players,
fired / cleared / rendered / floor cleaned), plus `test-modes`, `test-schools`,
`test-rush`.

## Done
- [x] Vacuum is a rare find (mob 0.1%, crate 1.2%)
- [x] Destruction: passives only offered once 2 school spells are owned
- [x] Destruction: Lava Ray aims down the fullest column
- [x] Destruction: Evocation lava drawn soft and UNDER boss telegraphs (all player ground fx under boss ground fx)
- [x] THE BAND kept as is (feel-powerful) — now one lane per player, staggered alarms
- [x] THE SWARM kept — burst and trickle scale harder with party size
- [x] THE CREEP (Pyraxis): spores seed creep, kill = purge patch; denser (cap 320+90n, 2+2n spores)
- [x] THE DANCE (Rotgrub): 4 infinite columns cut from the screen erupt in order (count-in bar sweeps top to bottom); at 55% it turns: infinite rows, bar sweeps side to side; both kill mobs
- [x] STONEFALL (Stonefather/LoS): boulders become rock cover; snipers need line of sight; scales with players
- [x] THE COLLAPSE (Worldeater/arena destruction): the SCREEN's margin becomes void and shrinks to a 40% island; bite + shove; bursts per bite
- [x] THE WARDS v2 (Prismwarden): THE SHEDDER — unkillable beast, sheds XP orbs per damage (flung 80-200px), slow-walks, leaps every 9s (7.5s at 3p+); rings relocate on take-off; landing = colour pulse (0.16 if not in your colour) + chaser burst; leaves at 85% of the timer
- [x] Jumpers / Polarity / Encircle removed from the table (code kept)
- [x] Encircle (benched) squeezes to contact and no longer self-dissolves, in case it returns
- [x] THE SLAGMAW ARC v2 (2026-08-31, after the first playtests: players did not
      pick up the clues, the waves felt weird, the PATH pick was not understood):
  - density: `dpsFactor()` is 1 for waves 1-5 (authored counts) and capped at 1.5
    past them; wave table 14/34/20/40, budgets 0/1/1+1/2 levels; CLASSIC deals at
    most 2 drafts per break (3 after a boss), the rest stays banked
    (`breakDraftCap`); Slagmaw `hpClassic` 25000 → 9500 (price only — the party
    now arrives L5-7; the DPS-priced term does the rest)
  - one mechanic per wave, same pattern ids: THE SMASHERS (smasher slam now
    shoves; rush 1.7x, plants at 70px or after 2.5s on your heels), THE OFFERING
    (the forge is a killable named target; each fed slug HEALS it — Slagmaw P2's
    consequence; kill = execution bonus, else it sinks; behemoth benched), THE
    CINDER VENTS (cinder ring only, one vent at a time, nearest to the party;
    5/7 vents; inward ring left to the boss). Burster / fire slug benched.
  - teaching without text: `setObjective()` — a standing one-line objective in
    the HUD for the whole wave, in the mechanic's colour; `subFlash` queues
    instead of overwriting; the per-mob callouts are gone
  - the PATH pick is a free draft at WAVE 1 CLEAR for every party size, on its
    own screen (permanent, what-you-do line, starter spells, GOOD FIRST PICK),
    fully in Spanish; the chained row is titled PICK YOUR FIRST SPELL
  - probes: `tools/probe-arc.mjs` (timeline, sub overwrites, slams/feeds/rings,
    damage by source) and `tools/probe-density.mjs` (on-camera counts)
  - known gaps (Slagmaw itself unchanged, owner call): the inward ring (P2/P3)
    and EMBER BRAND (P2) are not rehearsed before the fight
- [x] THE SLAGMAW ARC v1 (waves 1-5, 2026-08-28): Slagmaw is the Molten Core Ragnaros
      ("out for the slam, in for the ring", Sons walking to the forge); the waves
      before it now rehearse that in its colours (VOLC: orange slam, gold burst/ring,
      red lava). Budget 1/2/4/3/5 levels, 30/60/60/60/120s.
  - wave 1 untouched; its break is the DESCENT (input taken over, walk to the cave
    mouth, fade, `G.biome='volcano'`); the Slagmaw kill mirrors it as the ASCENT
  - wave 2 THE LAVA MIX: smasher (rush, plant, small slam w/ the boss telegraph),
    burster (gold pop + shove on any death), fire slug (red pool trail) in the drip
  - wave 3 THE SLUG FORGE: slug columns march at a forge; fed slugs heat it; it
    wakes as the SLAG BEHEMOTH (walks, slams) that sheds 40% of the eaten xp in
    orbs per hp chunk; sinks at 85% of the wave if ignored
  - wave 4 VOLCANIC PRESSURE: invulnerable vents alternate the CINDER RING (born on
    the safe disc's rim, 95px/s — inside is truly safe) and the inward ring; erratic
    lava rivers with gaps (`G.lava`, damage-on-stand, no slow)
  - Slagmaw: 3 phases (0.66/0.33). Slam shoves from P1; P2 adds smashers to the
    offerings; P3 THE CAULDRON CRACKS: lava rivers in the arena, bursters + fire
    slugs, and it positions so the slam throws you into a river
  - Cinder Ring fixed for real: `cinderRingAt` + `ai.ringSafeT` suppresses the
    boss's contact bite while the disc is up
  - test: `node tools/test-slagmaw.mjs`; the fauna never enters a 6+ mix (guarded)

## Open
- [ ] Polarity rework: fusion DETONATES (hurts players, destroys both marchers' XP) — then re-slot at wave 12
- [ ] Playtest multiplayer feel: band braid density, swarm carpet, creep cap, collapse island size (300px min may be tight for 3-4)
- [ ] Stonefall: mobs slide along rock rather than path — check chokepoint feel; bot gets stuck on boulders
- [ ] Wards: 1 ring per colour — with 4 players there are 4 rings; check screen clutter
- [ ] Collapse: consider a champion on the last bite so the 10s hold has a target
- [ ] Decide fate of Jumpers (only worth rebuilding as few/huge leapers if a leap boss needs the tutorial)
- [ ] Slagmaw arc v2 playtest: does the standing objective line get read; do players
      step out of the smasher disc by the end of wave 2; do they intercept slugs once the
      forge bar visibly refills; 4p readability of the vent's white disc
- [ ] Slagmaw hpClassic (9500) re-check with `balance-model solve` once real parties'
      arrival level settles — the probe bot is a weak interceptor in P2
- [ ] Slagmaw P2: EMBER BRAND and the inward ring are unrehearsed — if P2 keeps wiping
      couch parties the fix is in the boss (rehearse or drop brand), not the waves
- [ ] Boss-fight visual diet (not done, owner call 2026-08-31): damage numbers, gem
      sprites and bullet trails still sit on top of the ground telegraphs in 4p
