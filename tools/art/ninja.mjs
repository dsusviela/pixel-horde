// Ninja Adventure port (CC0, Pixel-boy) as a §1.3 art module for playground.html.
//   preview:  node tools/frame.mjs out.png --inject tools/art/ninja.mjs [--wave N ...]
//   sheets:   node tools/sheet.mjs sprites --family horde --inject tools/art/ninja.mjs
//   land:     node tools/art/land.mjs tools/art/ninja.mjs      (writes playground.html)
// Atlas: tools/art/ninja-atlas.png(+json) from build-ninja-atlas.mjs; inlined as base64.
// Density: every sprite is den 2 (one art px = half a world unit), so a 16 px
// monster is 8 units and a 2x2-tile quad of 16 px grass fills one 16-unit TILE.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const B64=fs.readFileSync(path.join(here,'ninja-atlas.png')).toString('base64');
const A=JSON.parse(fs.readFileSync(path.join(here,'ninja-atlas.json'),'utf8'));
const mon=n=>`atlasSheet(${A.mon[n][0]},${A.mon[n][1]},2)`;
const monBig=n=>`atlasSheet(${A.mon[n][0]},${A.mon[n][1]},2,2)`;
const chr=i=>`atlasSheet(${A.chr[i][0]},${A.chr[i][1]},2)`;
const T=(tx,ty,w=1,h=1)=>`atlasSprite(${tx*16},${ty*16},${w*16},${h*16},2)`;
const quad=(a,b,c,d)=>`atlasQuad([[${a}],[${b}],[${c}],[${d}]],2)`;
const item=(k,mul=1)=>`atlasSprite(${A.item[k][0]},${A.item[k][1]},${A.item[k][2]},${A.item[k][3]},2${mul!==1?','+mul:''})`;
// tileset picks (16 px tile units), verified against the sheet in tools/ninja-poc
const G0='14,15',G1='14,16',G2='14,16',G3='14,15';       // plain grass (12,16 carries an edge line, keep it out)
const FLW='15,16',PEB='13,16',BER='16,16';               // pebbles / leafy / berries
export default {
  __after:'lavaTileSprite',
  __patches:[
    // atlas loader + helpers, right after pal() so every const below can use them
    ["const pal=(...o)=>Object.assign({},...o);",
`const pal=(...o)=>Object.assign({},...o);
// ---- Ninja Adventure atlas (CC0, Pixel-boy; tools/art/ninja.mjs) ----
// atlasSprite(sx,sy,w,h,den,mul): a w*mul x h*mul canvas with the den tag, filled once the atlas decodes.
// atlasSheet: a 64x64 walk sheet (cols = facing down/up/left/right, rows = frames) -> the
// facing-down frame with .frames[dir][frame]; sheetFrame() picks one from a velocity.
// atlasQuad: four 16 px tiles into one 32x32 canvas (one 16-unit TILE at den 2).
const NINJA_B64='${B64}';
const NINJA={img:null,ready:false,pending:[]};
function atlasSprite(sx,sy,w,h,den,mul){mul=mul||1;const c=document.createElement('canvas');c.width=w*mul;c.height=h*mul;c.den=den||2;c.uw=c.width/c.den;c.uh=c.height/c.den;
  const fill=im=>{const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,sx,sy,w,h,0,0,w*mul,h*mul);};
  if(NINJA.ready)fill(NINJA.img);else NINJA.pending.push(fill);return c;}
function atlasSheet(sx,sy,den,mul){const fr=[];for(let d=0;d<4;d++){fr[d]=[];for(let f=0;f<4;f++)fr[d][f]=atlasSprite(sx+d*16,sy+f*16,16,16,den,mul);}const c=fr[0][0];c.frames=fr;return c;}
function atlasQuad(cells,den){const c=document.createElement('canvas');c.width=c.height=32;c.den=den||2;c.uw=c.uh=32/c.den;
  const fill=im=>{const g=c.getContext('2d');g.imageSmoothingEnabled=false;cells.forEach((t,i)=>g.drawImage(im,t[0]*16,t[1]*16,16,16,(i%2)*16,((i/2)|0)*16,16,16));};
  if(NINJA.ready)fill(NINJA.img);else NINJA.pending.push(fill);return c;}
function sheetFrame(spr,fx,fy,t){if(!spr.frames)return spr;const d=Math.abs(fx)>Math.abs(fy)?(fx<0?2:3):(fy<0?1:0);return spr.frames[d][(t|0)&3];}
function mobFrame(e){if(!e.spr.frames)return e.spr;const dx=e.x-(e._lx===undefined?e.x:e._lx),dy=e.y-(e._ly===undefined?e.y:e._ly);e._lx=e.x;e._ly=e.y;
  if(dx||dy){e._fx=dx;e._fy=dy;}return sheetFrame(e.spr,e._fx||0,e._fy===undefined?1:e._fy,G.time*7+(e.id||0));}
(function(){if(typeof Image==='undefined')return; /* headless test harness: sprites stay blank */ const im=new Image();im.onload=()=>{NINJA.img=im;NINJA.ready=true;for(const f of NINJA.pending)f(im);NINJA.pending.length=0;};im.src='data:image/png;base64,'+NINJA_B64;})();`],
    // horde draw: pick the facing/walk frame (bosses and hand-drawn art fall through unchanged)
    ["ctx.globalAlpha=0.6;drawSpriteC(ctx,e.spr,x,yy,s);ctx.globalAlpha=1;","ctx.globalAlpha=0.6;drawSpriteC(ctx,mobFrame(e),x,yy,s);ctx.globalAlpha=1;"],
    ["}else{\n      drawSpriteC(ctx,e.spr,x,yy,s);","}else{\n      drawSpriteC(ctx,mobFrame(e),x,yy,s);"],
    // hero draw: four-direction walk from faceX/faceY, frame from p.anim
    ["drawSpriteC(ctx,walkB?playerSpritesB[p.col]:playerSprites[p.col],x,y-2);",
     "drawSpriteC(ctx,sheetFrame(playerSprites[p.col],p.faceX||0,p.faceY===undefined?1:p.faceY,(p.anim||0)*4),x,y-2);"],
  ],
  // ---- hero: one character per colour slot (the light glow keeps PCOLORS as identity) ----
  playerSprites:{literal:`const playerSprites=[${[0,1,2,3,4,5,6,7].map(chr).join(',')}];`},
  playerSpritesB:{literal:`const playerSpritesB=playerSprites; // walk frames come from the sheet now`},
  // ---- horde (hostile-tinted in the atlas): role -> sheet ----
  chaserSprite:{literal:`const chaserSprite=${mon(11)}; // hooded ghost`},
  swarmSprite:{literal:`const swarmSprite=${mon(14)}; // imp`},
  spitSprite:{literal:`const spitSprite=${mon(17)}; // floating eye`},
  tankSprite:{literal:`const tankSprite=${monBig(8)}; // bear at 2x = 16 units`},
  bombSprite:{literal:`const bombSprite=${mon(2)}; // flamekin`},
  // ---- volcano fauna that share the horde read ----
  smasherSprite:{literal:`const smasherSprite=${monBig(1)}; // crab at 2x`},
  smasherCastSprite:{literal:`const smasherCastSprite=smasherSprite;`},
  bursterSprite:{literal:`const bursterSprite=${mon(19)}; // red skull`},
  bursterSwellSprite:{literal:`const bursterSwellSprite=bursterSprite;`},
  fireslugSprite:{literal:`const fireslugSprite=${mon(10)}; // spider`},
  // ---- pickups ----
  gemSprite:{literal:`const gemSprite=${T(7,13)};`},
  bigGemSprite:{literal:`const bigGemSprite=${T(7,12)};`},
  heartSprite:{literal:`const heartSprite=${item('heart')};`},
  crateSprite:{literal:`const crateSprite=atlasSprite(${A.item.chest[0]},${A.item.chest[1]},16,16,2);`},
  // ---- surface ground: 2x2 quads of 16 px tiles per 16-unit TILE ----
  TILES_SURFACE:{literal:`const TILES_SURFACE={base:[${quad(G0,G1,G2,G3)},${quad(G1,G0,G3,G2)},${quad(G2,G3,G0,G1)},${quad(G3,G2,G1,G0)}],tuft:[${quad(G0,FLW,G1,G3)},${quad(G1,G0,PEB,G2)},${quad(FLW,G3,G0,G1)}],pip:[${quad(G0,G1,G2,BER)},${quad(BER,G3,G1,G0)}],decor:[${T(0,10,2,2)},${T(12,10,2,2)},${T(2,10,2,2)},${quad(G0,'3,15',G1,'4,15')},${quad('13,8',G1,G0,'14,9')}]}; // bush, rock, bush, sunflower+clover, fern+flower`},
  PROPS_SURFACE:{literal:`const PROPS_SURFACE=[{spr:${T(6,10,2,2)},w:16,h:16,light:null},{spr:${T(0,3,2,2)},w:16,h:16,light:{dx:0,dy:-1,r:14,col:'#ffd27a',a:0.25}},{spr:${T(14,10,2,2)},w:16,h:16,light:null},{spr:${T(11,8,2,2)},w:16,h:16,light:null}]; // pine, torii, rocks, oak`},
};
