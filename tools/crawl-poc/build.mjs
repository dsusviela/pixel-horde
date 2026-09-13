// Packs tools/crawl-poc/norm/*.png (see norm.ps1) into one 12-column atlas and
// inlines it plus the name->[x,y] map into poc-crawl.tpl.html, writing
// ../../poc-crawl.html. Usage: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PixCanvas,readPng} from '../pixcanvas.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const names=fs.readFileSync(path.join(here,'tiles.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>l.split('=')[0]);
const COLS=12,T=32,rows=Math.ceil(names.length/COLS);
const cv=new PixCanvas(COLS*T,rows*T),ctx=cv.getContext('2d');
const map={};
names.forEach((n,i)=>{const im=readPng(fs.readFileSync(path.join(here,'norm',n+'.png')));const c=i%COLS,r=(i/COLS)|0;ctx.drawImage(im,c*T,r*T);map[n]=[c*T,r*T];});
const png=cv.png();
fs.writeFileSync(path.join(here,'atlas.png'),png);
let h=fs.readFileSync(path.join(here,'poc-crawl.tpl.html'),'utf8');
h=h.replace('@@ATLAS@@',png.toString('base64')).replace('@@MAP@@',JSON.stringify(map));
if(/@@/.test(h))throw new Error('placeholder left');
const out=path.resolve(here,'../../poc-crawl.html');
fs.writeFileSync(out,h);
console.log('atlas',cv.width+'x'+cv.height,names.length,'tiles ->',out,(h.length/1024|0)+' KB');
