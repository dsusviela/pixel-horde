// Sprite sheets, chunk bakes and the light layer of playground.html rendered
// through the real makeSprite/drawSpriteC/chunkCanvas on the software canvas
// (same sandbox as tools/frame.mjs; the file is read at run time).
//
//   node tools/sheet.mjs sprites --family F [--inject m.mjs] [--zoom 6] [--out sheet.png] [--emit]
//   node tools/sheet.mjs chunk --biome surface|volcano [--terrain pressure] [--at cx,cy] [--zoom 1] [--out]
//   node tools/sheet.mjs light [frame.mjs flags: --np --wave --school --biome --lava --gems --arena ...]
//
// sprites: every const of the family (FAMILIES below: name -> [r, scale, dy])
//   drawn at its den on BOTH biome grounds at --zoom, with the hitbox circle,
//   the centre cross and the feet line at y+r (mobs sit with feet at y+r; the
//   hero draws at y-2), a "1x" thumbnail beside it (rendered at the file's DEN,
//   box-filtered down to 1 px per world unit like the screen blit, shown x3),
//   and one crowd panel per ground: 30 seeded family sprites at 1x.
//   Families: hero horde fauna pups pickups props tiles overlays all
//   (props/tiles show a note until PROPS/TILES exist in the file — steps 5/6).
//   --inject: art module(s), comma-separated, in the §1.3 format (see
//   tools/pixboot.mjs applyInject); --emit prints the pasted-ready literals.
// chunk: chunkCanvas() for the 3x3 chunks around --at (default 0,0) as baked,
//   plus the glow chunk (c.glow, step 5) composited 'screen' beside it if present.
// light: a frame.mjs run whose output is the light canvas alone (lightC, step 4).
// Common: --file F (default playground.html), --out path (default sheet-<family>.png
//   / chunk-<biome>.png / light.png in the cwd), --seed S.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PixCanvas} from './pixcanvas.mjs';
import {bootPix,resolveFile,extractScript,applyInject,parseArgs,writePng,downsample,upscale,mulberry32} from './pixboot.mjs';
import {runFrame,finish} from './frame.mjs';

const BOOL=new Set(['emit','help','lava','gems','arena','screen','d2','hero2','light']);

// name -> [r (hitbox, 0 = none), scale, dy (draw offset the game uses), note]
export const FAMILIES={
  hero:{playerSprites:[6,1,-2,'8 tints, body 12x12, drawn at y-2'],playerSpritesDestro:[6,1,-2,'destro'],playerSpritesIllusion:[6,1,-2,'illusion'],playerSpritesNecro:[6,1,-2,'necro'],corpseSprite:[6,1,0,'']},
  horde:{chaserSprite:[5],swarmSprite:[3.5],spitSprite:[5],tankSprite:[9],bombSprite:[4.5],huntMarkSprite:[0,1,0,'at y-r-12'],eliteMarkSprite:[0,1,0,'at y-r-8']},
  fauna:{smasherSprite:[6.5],smasherCastSprite:[6.5],bursterSprite:[5],bursterSwellSprite:[5],fireslugSprite:[6],forgeSprites:[16,3,0,'forge, scale 3']},
  pups:{slagPupSprite:[4],emberlingSprite:[4],cinderSprite:[10,1.65,0,'cinder core r10 x1.65']},
  pickups:{gemSprite:[0],bigGemSprite:[0],heartSprite:[0],buffIcons:[0],crateSprite:[0],arenaTorchSprite:[0,1,-16,'at pillar y-16'],volcanoSprite:[0],caveMouthSprite:[0,2,0,'scale 2']},
  props:{PROPS:[0]},
  tiles:{TILES:[0]},
  overlays:{creepFrames:[0],voidFrames:[0],lavaFrames:[0],creepTileSprite:[0],voidTileSprite:[0],lavaTileSprite:[0]},
};
const CROWD_GROUND={hero:'surface',horde:'surface',fauna:'volcano',pups:'volcano',pickups:'surface',overlays:'volcano',props:'surface',tiles:'volcano'};

// ---- a 3x5 pixel font so the sheet labels itself (pixcanvas has no fillText) ----
const FONT={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111',
A:'010101111101101',B:'110101110101110',C:'111100100100111',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'111100101101111',H:'101101111101101',I:'111010010010111',J:'001001001101111',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'111101101101111',P:'111101111100100',Q:'111101101111011',R:'111101110101101',S:'111100111001111',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
'.':'000000000000010','-':'000000111000000',':':'000010000010000','/':'001001010100100','(':'010100100100010',')':'010001001001010','x':'000101010101000',',':'000000000010100','=':'000111000111000','+':'000010111010000','_':'000000000000111','[':'110100100100110',']':'011001001001011','%':'101001010100101','#':'010111010111010',' ':'000000000000000'};
export function text(c,x,y,s,col,k){
  const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle=col||'#ffffff';k=k||2;
  for(const ch0 of String(s)){
    const ch=FONT[ch0]?ch0:ch0.toUpperCase();const gl=FONT[ch]||FONT['.'];
    for(let i=0;i<15;i++)if(gl[i]==='1')g.fillRect(x+(i%3)*k,y+Math.floor(i/3)*k,k,k);
    x+=4*k;
  }
  return x;
}

const isCanvas=v=>v&&typeof v==='object'&&typeof v.getContext==='function';
// flatten any const (canvas | array | object | {spr,...} | nested tables) into [{label,spr,r,scale,dy,prop}]
function flatten(label,v,spec,out){
  const [r=0,scale=1,dy=0]=spec||[];
  if(isCanvas(v))out.push({label,spr:v,r,scale,dy});
  else if(Array.isArray(v))v.forEach((e,i)=>flatten(label+'['+i+']',e,spec,out));
  else if(v&&typeof v==='object'){
    if(isCanvas(v.spr))out.push({label,spr:v.spr,r:0,scale:1,dy:0,prop:v});
    else for(const k of Object.keys(v))flatten(label+'.'+k,v[k],spec,out);
  }
  return out;
}

function sheetSprites(g,o){
  const {ev}=g,fam=o.family||'all';
  const fams=fam==='all'?Object.keys(FAMILIES):fam.split(',');
  for(const f of fams)if(!FAMILIES[f]){console.error('unknown family '+f+'; have '+Object.keys(FAMILIES).join('|'));process.exit(2);}
  const Z=+(o.zoom||6),DEN=g.has('DEN')?+ev('DEN'):1,TILE=ev('TILE'),CHPX=ev('CHPX');
  const G=ev('G');G.state='title';
  // one ground chunk per biome (canvases survive the cache clear)
  ev('setBiome')('surface');const gS=ev('chunkCanvas')(0,0);
  ev('setBiome')('volcano');const gV=ev('chunkCanvas')(0,0);ev('setBiome')('surface');
  const grounds=[['surface',gS],['volcano',gV]];
  const drawSpriteC=ev('drawSpriteC');
  // hero hitbox from the live player object when available
  g.addPad();ev('joinPlayer')(0,0);const heroR=(G.players[0]&&G.players[0].r)||6;G.players.length=0;g.pads.length=0;
  // collect entries
  const entries=[],notes=[];
  for(const f of fams){
    for(const [name,spec0] of Object.entries(FAMILIES[f])){
      if(!g.has(name)){notes.push(f+': '+name+' not in file yet');continue;}
      const spec=spec0.slice();if(f==='hero'&&name!=='corpseSprite')spec[0]=heroR;
      const list=flatten(name,ev(name),spec,[]);
      for(const e of list){e.fam=f;e.note=spec0[3]||'';entries.push(e);}
    }
  }
  if(!entries.length){console.error('nothing to draw: '+notes.join('; '));process.exit(2);}
  // a cell renders one sprite on one ground at `z` texels per world unit
  const cellW=e=>{const uw=(e.spr.uw||e.spr.width)*e.scale,uh=(e.spr.uh||e.spr.height)*e.scale,ph=e.prop?e.prop.h||uh:uh;return [Math.max(32,2*Math.ceil((Math.max(uw,2*e.r)+12)/2)),Math.max(32,2*Math.ceil((Math.max(ph,2*e.r)+14)/2))];};
  function renderCell(e,ground,z,marks,seedI){
    const [cw,ch]=cellW(e),c=new PixCanvas(cw*z,ch*z),ctx=c.getContext('2d');
    const gden=ground.width/CHPX,gx=((seedI*37)%(CHPX-cw-2))*gden,gy=((seedI*53)%(CHPX-ch-2))*gden;
    ctx.setTransform(z,0,0,z,0,0);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(ground,gx,gy,cw*gden,ch*gden,0,0,cw,ch);
    const uh=(e.spr.uh||e.spr.height)*e.scale,cx=cw/2,cy=Math.round(ch/2+(e.r?e.r/2:0));
    let sy;
    if(e.prop)sy=cy-(e.prop.h||uh)/2+8;                 // step 6 prop pass: feet at y+h/2
    else if(e.r>0&&e.dy===0)sy=cy-(uh/2-e.r);           // enemy loop: feet at y+r
    else sy=cy+e.dy;                                    // hero y-2, torch y-16, pickups centred
    drawSpriteC(ctx,e.spr,cx,sy,e.scale);
    if(marks){
      ctx.setTransform(1,0,0,1,0,0);ctx.lineWidth=1;
      if(e.r>0){ctx.strokeStyle='rgba(255,0,255,0.85)';ctx.beginPath();ctx.arc(cx*z,cy*z,e.r*z,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillRect(0,Math.round((cy+e.r)*z),cw*z,1);}   // feet line at y+r
      ctx.fillStyle='rgba(255,64,255,0.9)';ctx.fillRect(cx*z-3,cy*z,7,1);ctx.fillRect(cx*z,cy*z-3,1,7);
      if(e.prop&&e.prop.light){const L=e.prop.light;ctx.strokeStyle=L.col||'#fff';ctx.beginPath();ctx.arc((cx+(L.dx||0))*z,(cy+(L.dy||0))*z,(L.r||8)*z,0,Math.PI*2);ctx.stroke();}
    }
    return c;
  }
  // layout: rows of [label | surface zoom | volcano zoom | thumb surface | thumb volcano]
  const LABW=190,TH=3,PAD=6;
  let rowsH=[],W=LABW;
  const rows=entries.map((e,i)=>{
    const cells=grounds.map(([b,gr])=>renderCell(e,gr,Z,true,i));
    const thumbs=grounds.map(([b,gr])=>{let t=renderCell(e,gr,DEN,false,i);if(DEN>1)t=downsample(t,DEN);return upscale(t,TH);});
    const h=Math.max(cells[0].height,thumbs[0].height,14)+PAD,w=LABW+cells[0].width*2+thumbs[0].width*2+PAD*5;
    W=Math.max(W,w);rowsH.push(h);return {e,cells,thumbs,h};
  });
  // crowd panels: 30 seeded family sprites at 1x on one ground per family, both grounds shown
  const mobs=entries.filter(e=>!e.label.includes('Mark')&&!e.label.startsWith('buffIcons')&&e.fam!=='tiles');
  const crowd=grounds.map(([b,gr],gi)=>{
    const cw=260,chh=120,z=DEN,c=new PixCanvas(cw*z,chh*z),ctx=c.getContext('2d'),gden=gr.width/CHPX;
    ctx.setTransform(z,0,0,z,0,0);ctx.imageSmoothingEnabled=false;
    for(let ty=0;ty<chh;ty+=CHPX)for(let tx=0;tx<cw;tx+=CHPX)ctx.drawImage(gr,0,0,CHPX*gden,CHPX*gden,tx,ty,CHPX,CHPX);
    const rng=mulberry32(+(o.seed||7)+gi);
    for(let i=0;i<30&&mobs.length;i++){
      const e=mobs[(rng()*mobs.length)|0],x=12+rng()*(cw-24),y=12+rng()*(chh-24),uh=(e.spr.uh||e.spr.height)*e.scale;
      drawSpriteC(ctx,e.spr,Math.round(x),Math.round(e.r>0&&e.dy===0?y-(uh/2-e.r):y+e.dy),e.scale);
    }
    let t=c;if(DEN>1)t=downsample(t,DEN);return upscale(t,TH);
  });
  const HEAD=44,crowdH=crowd[0].height+PAD*2+10;
  const H=HEAD+rowsH.reduce((a,b)=>a+b,0)+crowdH+PAD*2;
  W=Math.max(W,crowd[0].width*2+PAD*3);
  const sheet=new PixCanvas(W,H),sg=sheet.getContext('2d');
  sg.fillStyle='#0b0b10';sg.fillRect(0,0,W,H);
  text(sheet,PAD,PAD,'FAMILY '+fam+'  DEN '+DEN+'  ZOOM '+Z+'  file '+path.basename(g.file),'#ffffff',2);
  text(sheet,PAD,PAD+12,'checklist: footprint from r  den2 even dims  K outline+MAT ramp  reads at 1x both grounds  no gameplay colours  frames match  glow decided','#9aa2ad',1);
  text(sheet,PAD,PAD+20,'marks: magenta circle = hitbox r, cross = (x,y), white line = feet y+r; thumb = DEN render box-filtered to 1px/unit, x3','#9aa2ad',1);
  let y=HEAD;
  for(const r of rows){
    const e=r.e,dims=(e.spr.width)+'x'+(e.spr.height)+(e.spr.den?' den'+e.spr.den:'')+' r'+e.r+(e.scale!==1?' x'+e.scale:'');
    text(sheet,PAD,y+2,e.label.slice(0,26),'#ffffff',1);text(sheet,PAD,y+10,dims,'#c9a4ff',1);
    if(e.note)text(sheet,PAD,y+18,e.note.slice(0,40),'#9aa2ad',1);
    if(e.prop)text(sheet,PAD,y+26,('w'+e.prop.w+' h'+e.prop.h+(e.prop.light?' light':'')).slice(0,40),'#9aa2ad',1);
    let x=LABW;
    for(const c of r.cells){sg.setTransform(1,0,0,1,0,0);sg.drawImage(c,x,y);x+=c.width+PAD;}
    for(const t of r.thumbs){sg.drawImage(t,x,y);x+=t.width+PAD;}
    y+=r.h;
  }
  text(sheet,PAD,y+2,'CROWD x'+TH+' (30 at 1x): surface | volcano','#ffffff',1);y+=12;
  let x=PAD;for(const c of crowd){sg.drawImage(c,x,y);x+=c.width+PAD;}
  for(const n of notes)console.log('note:',n);
  return sheet;
}

function sheetChunk(g,o){
  const {ev}=g,biome=o.biome||'surface',[cx,cy]=String(o.at||'0,0').split(',').map(Number),Z=+(o.zoom||1),CHPX=ev('CHPX');
  const G=ev('G');G.state='title';
  ev('setBiome')(biome);
  if(o.terrain)ev('setTerrain')(o.terrain==='null'?null:o.terrain);
  const chunkCanvas=ev('chunkCanvas'),cs=[];let glow=false;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const c=chunkCanvas(cx+dx,cy+dy);cs.push({dx,dy,c});if(c.glow)glow=true;}
  const cpx=cs[0].c.width,S=cpx*3,W=glow?S*2+8:S,out=new PixCanvas(W,S),ctx=out.getContext('2d');
  for(const {dx,dy,c} of cs)ctx.drawImage(c,(dx+1)*cpx,(dy+1)*cpx,cpx,cpx);
  if(glow){
    // base + glow composited 'screen' beside the bare bake
    for(const {dx,dy,c} of cs)ctx.drawImage(c,S+8+(dx+1)*cpx,(dy+1)*cpx,cpx,cpx);
    ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;
    for(const {dx,dy,c} of cs)if(c.glow)ctx.drawImage(c.glow,S+8+(dx+1)*cpx,(dy+1)*cpx,cpx,cpx);
    ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
  }
  console.log('chunk',biome,'terrain',G.terrain,'at',cx+','+cy,'chunk px',cpx,'(CHPX '+CHPX+', den '+(cpx/CHPX)+')','glow',glow,'props',cs.reduce((a,e)=>a+(e.c.props?e.c.props.length:0),0));
  return upscale(out,Z);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL),cmd=o._[0];
  if(!cmd||o.help){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(cmd?0:2);}
  if(cmd==='light'){
    const r=await runFrame(o);
    if(!r.light){console.error('no light canvas in this file (lightC lands at step 4)');process.exit(2);}
    writePng(finish(r.light,o),o.out||'light.png');process.exit(0);
  }
  const file=resolveFile(o.file);let src=extractScript(file),literals=[];
  if(o.inject){const r=await applyInject(src,String(o.inject).split(','));src=r.src;literals=r.literals;}
  const g=bootPix({file,src,seed:+(o.seed||1)});
  if(o.emit)for(const l of literals)console.log(l);
  if(cmd==='sprites')writePng(sheetSprites(g,o),o.out||'sheet-'+(o.family||'all')+'.png');
  else if(cmd==='chunk')writePng(sheetChunk(g,o),o.out||'chunk-'+(o.biome||'surface')+'.png');
  else{console.error('unknown command '+cmd+' (sprites|chunk|light)');process.exit(2);}
  if(literals.length)console.log('injected',literals.length,'const(s)');
}
