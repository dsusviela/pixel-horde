// Volcano roster skin (2026-09-11, owner: "charred is the volcano skin, make the slag
// the second"): every horde mob gets a second sheet in the charred skin from
// horde-gen.mjs SKINS (same rigs and frames, warm charred ramp, ember eyes, lava
// scars on the hulk), emitted as <name>Volc consts after bombSprite, and
// setBiome() swaps ETYPES' sprites (and the sprites of enemies already alive) so the
// Slagmaw arc plays with these skins from the wave-1 descent on; the meadow keeps
// the grave skin. HORDE_VOLC_SKIN=slag re-emits with the second skin.
//   preview: HORDE_SKIN=charred node tools/art/preview.mjs --family horde --inject tools/art/horde-skin.mjs
//   land:    node tools/art/land.mjs tools/art/horde-volc.mjs && cd tools && npm run gates
import {skinSheet,SKINS} from './horde-gen.mjs';
import {sheetLiteral} from './mobgen.mjs';
const skin=process.env.HORDE_VOLC_SKIN||'charred';
const NAMES={chaser:'chaserSprite',swarm:'swarmSprite',spitter:'spitSprite',tank:'tankSprite',bomber:'bombSprite'};
const palExpr='pal('+JSON.stringify(SKINS[skin].pal)+')';
const mod={__after:'bombSprite'};
for(const [rig,c] of Object.entries(NAMES))mod[c+'Volc']={literal:sheetLiteral(c+'Volc',skinSheet(rig,skin),palExpr,2,rig+' in the '+skin+' skin, the volcano roster (tools/art/horde-volc.mjs)')};
const pairs=Object.entries(NAMES).map(([k,c])=>`['${k}',${c},${c}Volc]`).join(',');
mod.hordeSkin={literal:`const hordeSkin=b=>{const V=b==='volcano';for(const [k,g,v] of [${pairs}]){if(ETYPES[k])ETYPES[k].spr=V?v:g;for(const e of G.enemies)if(e.spr===(V?g:v))e.spr=V?v:g;}}; // volcano roster: the horde wears the ${skin} skin below ground (tools/art/horde-volc.mjs)`};
mod.__patches=[[`G.biome=b;chunkCanvases.clear();`,`G.biome=b;chunkCanvases.clear();hordeSkin(b);`]];
export default mod;
