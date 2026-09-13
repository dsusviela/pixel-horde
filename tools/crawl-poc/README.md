# Crawl tiles POC

`poc-crawl.html` (repo root) is a self-contained arena built from the CC0
Dungeon Crawl Stone Soup tileset: basalt floor, lava river, undead horde,
necromancer hero, balrug boss, ambient-dark light layer. Open it in
Chrome/Edge; the atlas is inlined so no server is needed.

Flags: `?light=0` `?glow=0` `?muted=0` (raw horde colours) `?ff=N` (fast-forward
N seconds before the first frame) `?god=1`. Keys: L / G / M toggle the same,
R restarts.

Rebuild:

    # 1. fetch the CC0 pack (2.7 MB) and unzip it anywhere
    #    https://opengameart.org/sites/default/files/crawl-tiles%20Oct-5-2010.zip
    pwsh -File norm.ps1 "<unzip dir>/crawl-tiles Oct-5-2010"   # -> norm/*.png
    node build.mjs                                            # -> ../../poc-crawl.html

`tiles.txt` is the tile selection (`name=path inside the pack`).
