// Packs the CC0 Ninja Adventure pack (Superpowers mirror layout) into one atlas
// and inlines it into poc-glade.tpl.html -> ../../poc-glade.html.
// Usage: node build.mjs <path to superpowers-asset-packs/ninja-adventure>
// Mirror: https://github.com/sparklinlabs/superpowers-asset-packs (CC0)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PixCanvas,readPng} from '../pixcanvas.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=process.argv[2];if(!src||!fs.existsSync(path.join(src,'monsters')))throw new Error('pass the ninja-adventure folder');
const load=p=>readPng(fs.readFileSync(path.join(src,p)));
const CHARS=[10,17,25,7,4,19];
const cv=new PixCanvas(1184,640),ctx=cv.getContext('2d');
const map={ts:[0,0],mon:{},chr:{},fx:{}};
ctx.drawImage(load('background-elements/tileset.png'),0,0);
for(let i=1;i<=22;i++){const c=(i-1)%8,r=((i-1)/8)|0;const x=448+c*64,y=r*64;ctx.drawImage(load(`monsters/${i}.png`),x,y);map.mon[i]=[x,y];}
CHARS.forEach((n,i)=>{const x=448+i*64,y=192;ctx.drawImage(load(`characters/${n}.png`),x,y);map.chr[n]=[x,y];});
for(let i=1;i<=20;i++){const im=load(`fx/${i}.png`);const x=960,y=(i-1)*32;ctx.drawImage(im,x,y);map.fx[i]=[x,y,im.width/32];}
const png=cv.png();
fs.writeFileSync(path.join(here,'atlas.png'),png);
let h=fs.readFileSync(path.join(here,'poc-glade.tpl.html'),'utf8');
h=h.replace('@@ATLAS@@',png.toString('base64')).replace('@@MAP@@',JSON.stringify(map));
if(/@@/.test(h))throw new Error('placeholder left');
const out=path.resolve(here,'../../poc-glade.html');
fs.writeFileSync(out,h);
console.log('atlas',cv.width+'x'+cv.height,'->',out,(h.length/1024|0)+' KB');
