# Glade POC (Ninja Adventure)

`poc-glade.html` (repo root) is a self-contained sunlit-glade arena built from
the CC0 Ninja Adventure pack by Pixel-boy: grass and path tiles, a stream with
lily pads, shrine props, 12 animated four-direction monsters (the menacing sheets only, drawn through a hostile tint), a 1.5x hero,
sparkle effects and a bear boss. Open it in Chrome/Edge; the atlas is inlined.

Flags: `?dusk=1` (light layer on) `?glow=0` `?ff=N` (fast-forward N seconds)
`?god=1` `?muted=0` (raw monster colours). Keys: N dusk, G glow, M hostile tint, R restart.

Rebuild:

    git clone --depth 1 https://github.com/sparklinlabs/superpowers-asset-packs
    node build.mjs <clone>/ninja-adventure          # -> ../../poc-glade.html

The GitHub mirror is the older cut of the pack (22 monsters, 25 characters,
20 effects, one tileset). The itch.io release adds more monsters, bosses and
tilesets under the same CC0 license: https://pixel-boy.itch.io/ninja-adventure-asset-pack

Sheet layout: monsters are 64x64 with columns = facing (down, up, left, right)
and rows = walk frames; characters are 64x112 with the same first four rows.
