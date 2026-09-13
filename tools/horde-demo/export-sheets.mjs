// dumps every horde rig's sheet (grave letters) plus the SKINS palettes/letter maps for the demo page
//   node tools/horde-demo/export-sheets.mjs out/horde-sheets.json
import fs from 'node:fs';
import {sheet,SKINS} from '../art/horde-gen.mjs';
const out={skins:{},mobs:{}};
for(const [k,v] of Object.entries(SKINS))out.skins[k]={pal:v.pal,map:v.map};
for(const n of ['chaser','swarm','spitter','tank','bomber','bombFuse'])out.mobs[n]=sheet(n);
fs.writeFileSync(process.argv[2],JSON.stringify(out));
console.log('wrote',process.argv[2],(fs.statSync(process.argv[2]).size/1024|0)+' KB');
