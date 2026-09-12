---
name: pixel-art
description: Draw, trace or revise pixel-art sprites for pixel-horde (makeSprite rows + MAT palettes, den 2): the sketch → lint → preview → sheet → frame → owner-reaction → land workflow, the per-family footprints, and the craft rules in rules.md. Load before any sprite, tile, VFX frame, boss body or palette work in playground.html.
---

# Pixel art for pixel-horde

Sprites are text: one string per row, one letter per texel, `.` transparent,
a palette object mapping letters to hex. `makeSprite(rows,pal,2)` turns them
into a den-2 canvas (two texels per world unit). You never draw through an
editor; you write rows, render them, look at the PNG, and fix the rows. The
failures to expect are structural (row widths, symmetry, global shape), so
every sprite goes through the mechanical checks below before anyone judges
its look. Read `rules.md` once per session; `palettes.md` when picking colours.

## Facts that constrain every sprite

- **Letters** (MAT convention in playground.html): `K` outline/darkest, `D` dark, `M` mid, `L` light, `H` highlight; accents `O` ember, `Y` gold, `R` red, `G` rot green, `V` violet, `C` cyan, `W` white/hot core. `pal(MAT.x,{...})` merges ramps.
- **Footprint** comes from the family table in `tools/sheet.mjs` (`FAMILIES`): mobs sit with feet on the bottom row at `y+r`, width 2r to 2.4r units; the hero is 12x12 units drawn at y-2; tiles are 16 units (32 texels). Even dims at den 2.
- **Gameplay colours are reserved**: orange/red floor = damage, white = safe, gem cyan/green, heart pink, missile yellow. Do not use them on non-gameplay parts.
- **Art direction**: ambient darkness cut by light; near-black desaturated ground; muted grey/purple horde with glowing eyes as the only high-contrast cluster; the hero is the only saturated colour. Light language: green = healing/life, orange = lava/danger, violet = arcane/souls. Volcano fauna keep the Slagmaw ember ramp.
- **Atlas art** (Ninja Adventure, `tools/art/ninja.mjs`) is 16 px, 4 facings x 4 frames, `columns = facing, rows = frames`. Hand-drawn art must read at the same density and outline weight next to it.

## Workflow (do not skip steps; do not land before step 7)

1. **Spec** the sprite in one line: family, const name, r/scale from `FAMILIES`, texel dims, palette (`MAT.x` or a `ramp.mjs` output), glow emitter (none or r/col/a), frame count.
2. **Sketch** rows in an art module `tools/art/<name>.mjs` (format below), or a sketch JSON `{rows,pal,den}` when the const does not exist yet. Draw in this order: blob the silhouette in 2 to 3 flat colours, silhouette test, then the light/shadow split, then small blending clusters, then the outline, then eyes/highlights last. Count columns explicitly and keep every row the same width; for symmetric bodies write the left half and mirror it.
3. **Lint**: `node tools/art/lint.mjs --inject tools/art/<name>.mjs` (or `--json sketch.json`). Errors must be zero. Warnings are read, not silenced: orphans are fine for eyes and highlights, banding on a straight outline is fine, low ground contrast is not.
4. **Preview**: `node tools/art/preview.mjs <const> --inject tools/art/<name>.mjs --out <scratch>` then open the PNG with the Read tool and read it next to the printed rows (rule 63). Check: silhouette reads at 1x on both grounds; the outline is 1 texel; the eye cluster is the brightest thing; no jaggies or doubles on curves.
5. **Sheet**: `node tools/sheet.mjs sprites --family <F> --inject tools/art/<name>.mjs` for the family row, the 1x thumbnail and the crowd panel; then `node tools/frame.mjs out.png --inject tools/art/<name>.mjs --wave N` for the sprite in a live frame (bosses: `--wave 10 --bossnear 60 --crop 250,0,600,320 --zoom 2`).
6. **Owner reaction**: send the preview and the frame with SendUserFile, compare against the concept sheets in the same message, and wait. One sprite or one change per round; never a full suite.
7. **Land**: `node tools/art/land.mjs tools/art/<name>.mjs`, then `cd tools && npm run gates`. Land through the module, never by pasting into playground.html by hand.

Frames: keep dims and palette identical across a set, change only what moves (rule 51), and run the frame lint (IoU and drift are reported per pair).

## Art module format (tools/pixboot.mjs §1.3)

```js
export default {
  __after:'lavaTileSprite',                    // anchor for new consts
  __patches:[[findExact,replaceExact]],        // optional exact-string edits
  chaserSprite:{rows:[...],pal:'pal(MAT.chaser,{R:"#e33c3c"})',den:2,note:'16x16 den 2, feet on row 15'},
  ACCENT_X:{literal:'const ACCENT_X=[makeSprite(...),makeSprite(...)];'},
};
```
A name already in the file is replaced in place; a new name is appended after `__after`. `--emit` on sheet.mjs prints the pasted-ready literals.

## Tools (all zero-dep, `cd tools && npm run art:<tool> -- ...` or `node tools/art/<tool>.mjs`)

| tool | use |
|---|---|
| `preview.mjs NAME --inject m.mjs` / `--json sketch.json` / `--family F` | grid preview on both grounds + 1x read + legend + frame strip, rows printed |
| `lint.mjs NAME` / `--inject` / `--family` / `--json` `[--strict] [--quiet]` | ragged rows, letters, dims, colour budget, orphans, banding, outline, contrast, frame IoU/drift |
| `ramp.mjs --hue 25 [--steps 5] [--l a,b] [--chroma c] [--shift s]` / `from '#hex'` / `lospec <slug>` / `mat` | hue-shifted OKLCH ramp as a MAT object + swatch PNG; Lospec palette; every MAT ramp with L values |
| `trace.mjs ref.png --pal MAT.x\|lospec:slug\|'#a,#b' [--crop x,y,w,h] [--scale N] [--bg auto]` | reference PNG → rows against a palette (true texel scale auto-detected), sketch JSON, lint |
| `sheet.mjs sprites --family F --inject m.mjs`, `frame.mjs --inject m.mjs`, `art/land.mjs m.mjs` | existing: family sheet, live frame, landing |

## Reference art (optional, disclose)

- Trace a concept-sheet crop first: `trace.mjs sheet.png --crop x,y,w,h --pal MAT.ember --max 48`. The result is a base; eyes, outline and feet are always redrawn.
- Retro Diffusion (hosted MCP, pay per image, true-grid output down to 12 px, palette lock): `claude mcp add --transport http retro-diffusion https://mcp.retrodiffusion.ai/mcp --header "Authorization: Bearer rdpk-..."`. Use `rd_pro__topdown` for bosses, `rd_animation__vfx` for effects, always `estimate_inference_cost` first, never auto-retry a timed-out generation.
- Any generated asset gets an `ai-provenance.json` beside it (tool, style, seed, request id, post-edits). Beowulf's HUGE pack bans gen-AI anywhere in the same project; Ninja Adventure, Franuka, Foozle and pimen do not.

## Reading the lint

- `ERR ragged / unknown-letter / odd-dims / magenta / frame-dims`: fix before anything else.
- `WARN budget`: over the colour budget for the size (rule 17); merge ramps.
- `WARN orphans`: list them; keep eyes and highlights, remove the rest.
- `WARN banding`: parallel same-length runs; shift one edge by a texel (rule 12) unless it is the outline of a deliberate box.
- `WARN outline`: small sprites want a K outline on the shadow side and against the ground (rules 33, 37).
- `WARN contrast`: the body sits at the ground's value; push the mid tone or add the K outline (rule 24).
- `WARN iou / drift`: a frame moved too much; walk frames keep the body and move limbs (rules 47, 51).
