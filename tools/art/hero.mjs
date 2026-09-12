// Hero art module (2026-09-12): the mage rig in tools/art/hero-gen.mjs as the
// eight player sheets, one set per school (base / destro / illusion / necro),
// each with a 4-frame walk (frames[dir][k]) and a 4-frame idle (idle[dir][k]).
// The hero draw picks the school's sheet for the player's colour, walks it when
// the player moves (facing = movement direction) and idles it when standing.
// The old atlas hero and the ACCENT_* overlays stop being drawn (the school is
// the body now); the school glows stay.
//   lint:    node tools/art/lint.mjs playerSprites --inject tools/art/hero.mjs
//   sheet:   node tools/sheet.mjs sprites --family hero --inject tools/art/hero.mjs
//   frame:   node tools/frame.mjs out.png --inject tools/art/hero.mjs --school necro --frames 45
//   land:    node tools/art/land.mjs tools/art/hero.mjs && cd tools && npm run gates
// Roll back by landing tools/art/ninja.mjs again (its playerSprites line replaces this one).
import {heroSheet,HERO_PAL,PHIGH,SCHOOLS} from './hero-gen.mjs';

const DIRS=['down','up','left','right'];
const ROWS={};
for(const s of SCHOOLS){const S=heroSheet(s);ROWS[s]={walk:DIRS.map(d=>S.walk[d]),idle:DIRS.map(d=>S.idle[d])};}
const sheets=(school)=>`PCOLORS.map((_,i)=>heroSheet(HERO_ROWS.${school},i))`;

export default {
  HERO_PAL:{after:'PSHADES',literal:'const HERO_PAL='+JSON.stringify(HERO_PAL)+'; // shared mage letters (tools/art/hero-gen.mjs); P/S/H come from PCOLORS/PSHADES/PHIGH'},
  PHIGH:{after:'HERO_PAL',literal:'const PHIGH='+JSON.stringify(PHIGH)+'; // per-player robe highlight'},
  HERO_ROWS:{after:'PHIGH',literal:'const HERO_ROWS='+JSON.stringify(ROWS)+'; // mage 24x24 den 2 per school: walk[dir][4], idle[dir][4], dir = down/up/left/right'},
  heroSheet:{after:'HERO_ROWS',literal:'const heroSheet=(R,i)=>{const P=pal(HERO_PAL,{P:PCOLORS[i],S:PSHADES[i],H:PHIGH[i]}),mk=d=>d.map(r=>makeSprite(r,P,2)),fr=R.walk.map(mk),c=fr[0][0];c.frames=fr;c.idle=R.idle.map(mk);return c;};'},
  playerSprites:{literal:`const playerSprites=${sheets('base')}; // base mage (no path yet): frames[dir][k] walk, idle[dir][k]`},
  playerSpritesB:{literal:'const playerSpritesB=playerSprites; // walk frames come from the sheet'},
  playerSpritesDestro:{after:'playerSpritesB',literal:`const playerSpritesDestro=${sheets('destro')};`},
  playerSpritesIllusion:{after:'playerSpritesDestro',literal:`const playerSpritesIllusion=${sheets('illusion')};`},
  playerSpritesNecro:{after:'playerSpritesIllusion',literal:`const playerSpritesNecro=${sheets('necro')};`},
  HERO_SCHOOL:{after:'playerSpritesNecro',literal:'const HERO_SCHOOL={destro:playerSpritesDestro,illusion:playerSpritesIllusion,necro:playerSpritesNecro};'},
  heroFrame:{after:'HERO_SCHOOL',literal:"const heroFrame=p=>{const S=((p.school&&HERO_SCHOOL[p.school])||playerSprites)[p.col],fx=p.faceX||0,fy=p.faceY===undefined?1:p.faceY;if(p.moving)return sheetFrame(S,fx,fy,(p.anim||0)*4);const d=Math.abs(fx)>Math.abs(fy)?(fx<0?2:3):(fy<0?1:0);return S.idle[d][Math.floor(G.time*3+(p.idx||0))&3];}; // walk while moving (facing = last movement), idle at 3 fps when standing"},
  __patches:[
    ["if(mx||my){p.faceX=mx;p.faceY=my;p.anim+=dt*8;","p.moving=(mx||my)?1:0;if(mx||my){p.faceX=mx;p.faceY=my;p.anim+=dt*8;"],
    ["drawSpriteC(ctx,sheetFrame(playerSprites[p.col],p.faceX||0,p.faceY===undefined?1:p.faceY,(p.anim||0)*4),x,y-2);","drawSpriteC(ctx,heroFrame(p),x,y-2);"],
    ["if(p.school==='destro'){drawSpriteC(ctx,ACCENT_DESTRO,x,y-2);glow(","if(p.school==='destro'){glow("],
    ["else if(p.school==='illusion'){drawSpriteC(ctx,ACCENT_ILLUSION[Math.floor(G.time*6)%4],x,y-2);const sy=y-9+Math.sin(G.time*3);drawSpriteC(ctx,SHARD,x+7,sy);glow(x+7,sy,4,'#c9a4ff',0.20);}","else if(p.school==='illusion'){glow(x,y+5,6,'#c9a4ff',0.12);}"],
    ["else if(p.school==='necro'){drawSpriteC(ctx,ACCENT_NECRO,x,y-2);glow(","else if(p.school==='necro'){glow("],
  ],
};
