// dumps the two biome chunk canvases (as the game bakes them) to PNG for the demo page
import {bootArt} from 'file:///C:/Users/daniel/Documents/development/pixel-horde/tools/art/targets.mjs';
import {writePng} from 'file:///C:/Users/daniel/Documents/development/pixel-horde/tools/pixboot.mjs';
import fs from 'node:fs';
const out=process.argv[2];
const {g}=await bootArt({file:'playground.html'});
const ev=g.ev,G=ev('G');G.state='title';
for(const [biome,label] of [['volcano','basalt'],['surface','grass']]){
  ev('setBiome')(biome);const c=ev('chunkCanvas')(0,0);
  writePng(c,out+'/ground-'+label+'.png');
  console.log(label,c.width,c.height);
}
