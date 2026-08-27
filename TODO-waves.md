# Wave variety — requirements & status

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
- [x] THE DANCE (Rotgrub): 4 lanes on the LIVE screen erupt in order; eruption kills mobs; reverses at 55%
- [x] STONEFALL (Stonefather/LoS): boulders become rock cover; snipers need line of sight; scales with players
- [x] THE COLLAPSE (Worldeater/arena destruction): the SCREEN's margin becomes void and shrinks to a 40% island; bite + shove; bursts per bite
- [x] THE WARDS (Prismwarden): stand in your colour when the pulse lands; wards relocate, horde follows
- [x] Jumpers / Polarity / Encircle removed from the table (code kept)
- [x] Encircle (benched) squeezes to contact and no longer self-dissolves, in case it returns

## Open
- [ ] Polarity rework: fusion DETONATES (hurts players, destroys both marchers' XP) — then re-slot at wave 12
- [ ] Playtest multiplayer feel: band braid density, swarm carpet, creep cap, collapse island size (300px min may be tight for 3-4)
- [ ] Stonefall: mobs slide along rock rather than path — check chokepoint feel; bot gets stuck on boulders
- [ ] Wards: 1 ring per colour — with 4 players there are 4 rings; check screen clutter
- [ ] Collapse: consider a champion on the last bite so the 10s hold has a target
- [ ] Decide fate of Jumpers (only worth rebuilding as few/huge leapers if a leap boss needs the tutorial)
