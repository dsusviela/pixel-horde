// Builds tools/art/ninja-atlas.png + ninja-atlas.json from the CC0 Ninja
// Adventure pack (Superpowers mirror layout) for the tools/art/ninja.mjs art
// module. Usage: node tools/art/build-ninja-atlas.mjs <superpowers-asset-packs/ninja-adventure>
// Mirror: https://github.com/sparklinlabs/superpowers-asset-packs
//
// Layout (all 1x art pixels):
//   tileset      0,0      448x640   background-elements/tileset.png as-is
//   monsters     448,0    8 per row of 64x64 sheets, 22 sheets, hostile-tinted
//   characters   448,192  8 sheets of 64x112 (HERO_CHARS order = PCOLORS slot)
//   fx           960,y    20 strips, 32 px tall, at y=(n-1)*32
//   items        448,304  heart, medipack, chest frame, gold coin, silver coin
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PixCanvas,readPng} from '../pixcanvas.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=process.argv[2];if(!src||!fs.existsSync(path.join(src,'monsters')))throw new Error('pass the ninja-adventure folder');
const load=p=>readPng(fs.readFileSync(path.join(src,p)));
export const HERO_CHARS=[10,17,25,7,4,19,6,9]; // one character per PCOLORS slot
const cv=new PixCanvas(1184,640),ctx=cv.getContext('2d');
const map={ts:[0,0],mon:{},chr:{},fx:{},item:{}};
ctx.drawImage(load('background-elements/tileset.png'),0,0);
for(let i=1;i<=22;i++){const c=(i-1)%8,r=((i-1)/8)|0;const x=448+c*64,y=r*64;ctx.drawImage(load(`monsters/${i}.png`),x,y);map.mon[i]=[x,y];}
HERO_CHARS.forEach((n,i)=>{const x=448+i*64,y=192;ctx.drawImage(load(`characters/${n}.png`),x,y);map.chr[i]=[x,y];});
for(let i=1;i<=20;i++){const im=load(`fx/${i}.png`);const x=960,y=(i-1)*32;ctx.drawImage(im,x,y);map.fx[i]=[x,y,im.width/32];}
let ix=448;for(const [k,f] of [['heart','items/heart.png'],['medipack','items/medipack.png'],['chest','items/little-treasure-chest.png'],['gold','items/gold-coin.png'],['silver','items/silver-coin.png']]){const im=load(f);ctx.drawImage(im,ix,304);map.item[k]=[ix,304,im.width,im.height];ix+=im.width+2;}
// hostile tint over the monster block only: keep reds, dim greens, lean violet
const d=cv.data;
for(let y=0;y<192;y++)for(let x=448;x<960;x++){const i=(y*cv.width+x)*4;if(d[i+3]<=0)continue;const r=d[i],g=d[i+1],b=d[i+2],l=0.3*r+0.59*g+0.11*b,sat=0.7;
  d[i]=Math.min(255,(l+(r-l)*sat)*0.86+8);d[i+1]=(l+(g-l)*sat)*0.72;d[i+2]=Math.min(255,(l+(b-l)*sat)*0.84+4);}
fs.writeFileSync(path.join(here,'ninja-atlas.png'),cv.png());
fs.writeFileSync(path.join(here,'ninja-atlas.json'),JSON.stringify(map));
console.log('atlas',cv.width+'x'+cv.height,'->',path.join(here,'ninja-atlas.png'));
