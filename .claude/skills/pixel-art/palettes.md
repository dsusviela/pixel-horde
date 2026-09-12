# Palettes

`node tools/art/ramp.mjs mat` prints every MAT ramp with OKLab L values; `ramp.mjs lospec <slug>` fetches any of these and writes a swatch. Snap a generated ramp to one with `--snap lospec:<slug>`.

## Dark fantasy (surface night meadow, volcano, horde)

- **Apollo** (`apollo`, 46, AdamCYounis). Best single fit for the concept sheets: desaturated blues and greys for ground, purples for the horde, orange ramp for lava, green ramp for healing.
  `#172038 #253a5e #3c5e8b #4f8fba #73bed3 #a4dddb #19332d #25562e #468232 #75a743 #a8ca58 #d0da91 #4d2b32 #7a4841 #ad7757 #c09473 #d7b594 #e7d5b3 #341c27 #602c2c #884b2b #be772b #de9e41 #e8c170 #241527 #411d31 #752438 #a53030 #cf573c #da863e #1e1d39 #402751 #7a367b #a23e8c #c65197 #df84a5 #090a14 #10141f #151d28 #202e37 #394a50 #577277 #819796 #a8b5b2 #c7cfcc #ebede9`
- **Endesga 32** (`endesga-32`). Cool near-black `#181425 #262b44 #3a4466` ground, grey-purple `#68386c #b55088` horde, `#f77622 #feae34 #fee761` lava, `#3e8948 #63c74d` healing.
  `#be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633 #e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e #124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466 #262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569`
- **Oil 6** (`oil-6`, GrafxKid). A cool-shadow to warm-light six-step monoramp; the template for the muted purple horde.
  `#272744 #494d7e #8b6d9c #c69fa5 #f2d3ab #fbf5ef`
- **SLSO8** (`slso8`). Navy to orange in eight steps: lava-cut darkness in one ramp.
  `#0d2b45 #203c56 #544e68 #8d697a #d08159 #ffaa5e #ffd4a3 #ffecd6`
- **Ochre Ruin** (`ochre-ruin`, 12, Quemis). Mossy stone and amber fog for ruins and ground.
  `#0a151f #191d29 #1d272f #5e7b75 #1b181c #54403f #7e6668 #b7a691 #30322d #515650 #9ba28c #e7daba`

## Lorwyn glade (sparkly high fantasy)

- **Fairytale Forest** (`fairytale-forest`, 20, Deadman). Creams and golds for sparkle, olive greens, teal shadows, plum darks.
  `#f7e4cd #f9e1ad #fcc17c #d3a957 #d0c15a #a89c45 #827830 #443a25 #ea9275 #af5e44 #7c3939 #4f1f1f #a0b6af #678688 #435e64 #243841 #997a7d #6c5658 #422f37 #0f0b0c`
- **Resurrect 64** (`resurrect-64`, Kerrie Lake). Full green, teal, violet and gold ramps; the saturated master palette.
  `#2e222f #3e3546 #625565 #966c6c #ab947a #694f62 #7f708a #9babb2 #c7dcd0 #ffffff #6e2727 #b33831 #ea4f36 #f57d4a #ae2334 #e83b3b #fb6b1d #f79617 #f9c22b #7a3045 #9e4539 #cd683d #e6904e #fbb954 #4c3e24 #676633 #a2a947 #d5e04b #fbff86 #165a4c #239063 #1ebc73 #91db69 #cddf6c #313638 #374e4a #547e64 #92a984 #b2ba90 #0b5e65 #0b8a8f #0eaf9b #30e1b9 #8ff8e2 #323353 #484a77 #4d65b4 #4d9be6 #8fd3ff #45293f #6b3e75 #905ea9 #a884f3 #eaaded #753c54 #a24b6f #cf657f #ed8099 #831c5d #c32454 #f04f78 #f68181 #fca790 #fdcbb0`
- **Forrest 40** (`forrest-40`, 32). Desaturated forest with a lavender-blue ramp for magic.
- **Verdant Deep Woods** (`verdant-deep-woods`, 9). Glowing green monoramp for the healing light language and foliage under darkness.
  `#000c2c #001d37 #003645 #005858 #00755c #039a5d #15bd5e #00d459 #66f390`

## Building a ramp for a new material

1. Pick the mid tone's hue and chroma: `ramp.mjs from '#hex'`, or `--hue H --chroma C` (horde bodies: chroma 0.06 to 0.09; ember: 0.18 to 0.2).
2. Read the L line: adjacent steps should differ by at least 0.08 (rule 24); the K step sits near 0.18 to 0.25 so it separates from basalt (L 0.27) and grass (L 0.34).
3. Reuse an existing K across materials where the sprite touches another family (rule 23).
4. Paste the printed `name:{...}` line into `MAT`, and reference it as `'MAT.name'` in the art module.
