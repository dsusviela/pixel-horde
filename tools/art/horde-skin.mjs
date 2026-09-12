// Horde skin module (2026-09-11): every horde sheet re-emitted in one skin from
// horde-gen.mjs SKINS. HORDE_SKIN=charred|cinder|slag|grave picks the skin.
//   HORDE_SKIN=charred node tools/frame.mjs out.png --inject tools/art/horde-skin.mjs ...
// This replaces the five consts in place (screenshot/compare use). The landing module
// for the volcano roster is horde-volc.mjs (emits <name>Volc consts + the biome swap).
import {skinSheet,SKINS} from './horde-gen.mjs';
import {sheetLiteral} from './mobgen.mjs';
const skin=process.env.HORDE_SKIN||'charred';
export const NAMES={chaser:'chaserSprite',swarm:'swarmSprite',spitter:'spitSprite',tank:'tankSprite',bomber:'bombSprite'};
const palExpr='pal('+JSON.stringify(SKINS[skin].pal)+')';
const mod={};
for(const [rig,c] of Object.entries(NAMES))mod[c]={literal:sheetLiteral(c,skinSheet(rig,skin),palExpr,2,rig+' in the '+skin+' skin (tools/art/horde-skin.mjs)')};
export default mod;
