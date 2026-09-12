// Crystal shard tile art module (2026-09-12): six shimmer frames + the fracture
// overlay from tools/art/crystal-gen.mjs, landed next to the other overlay frame
// banks (creep / void / lava). render() draws G.shards with them.
//   preview: node tools/art/preview.mjs crystalFrames --inject tools/art/crystal.mjs --out <dir>
//   land:    node tools/art/land.mjs tools/art/crystal.mjs
import {crystalRows,crackRows,CRYSTAL_PAL} from './crystal-gen.mjs';

const P=JSON.stringify(CRYSTAL_PAL);
const mirror=r=>r.split('').reverse().join('');
export default {
  __after:'lavaFrames',
  crystalFrames:{literal:'const crystalFrames='+JSON.stringify([0,1,2,3,4,5].map(crystalRows))+'.map(r=>makeSprite(r,'+P+',2)); // crystal shard tile, 6 shimmer frames (tools/art/crystal-gen.mjs)'},
  crystalCrackFrame:{literal:'const crystalCrackFrame=makeSprite('+JSON.stringify(crackRows())+','+P+',2); // fracture overlay for a damaged shard'},
  // the same six frames mirrored: drawShards alternates the two banks by tile parity so a field does not read as one repeating stamp
  crystalFramesB:{after:'crystalCrackFrame',literal:'const crystalFramesB='+JSON.stringify([0,1,2,3,4,5].map(f=>crystalRows(f).map(mirror)))+'.map(r=>makeSprite(r,'+P+',2));'},
  crystalCrackFrameB:{after:'crystalFramesB',literal:'const crystalCrackFrameB=makeSprite('+JSON.stringify(crackRows().map(mirror))+','+P+',2);'},
};
