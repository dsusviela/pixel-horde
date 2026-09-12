// Renders a live game frame of playground.html through the real render() on
// the software canvas (tools/pixcanvas.mjs) and writes a PNG.
//
//   node tools/frame.mjs [out.png] [flags]          (default out: frame.png)
//
// Run shape
//   --file F          workspace html to boot (default playground.html; read at run time)
//   --np N            players / pads (default 1)
//   --seed S          Math.random seed (default 40+np, the test harness seed for that party)
//   --frames N        sim frames before the shot (default 420); ignored when --wave is set
//   --wave N          run until G.wave===N (cap --max frames, default 90000), then --settle
//                     frames (default 240) so the wave has spawned
//   --school S        destro|illusion|necro: every player picks that school card at the
//                     first draft, and after the run the school's kit (blaster + actives,
//                     lv --kit-lv, default 3, plus passives) is granted through the same
//                     takeOffer(pick,true) path the test uses
//   --q "k=v&k2"      location.search for the booted file (e.g. --q density=1, --q light=0)
//   --inject m.mjs    art module(s) (comma-separated) string-replaced before boot (§1.3 format)
// Scene tweaks (applied after the run, before render)
//   --biome B         setBiome(B): surface|volcano
//   --terrain T       setTerrain(T): pressure (lava rivers everywhere) | null
//   --lava            a hand-carved lava band under the party (G.lava overlay)
//   --gems            12 gems around player 1
//   --bossnear [DX]   move the live boss to DX units right of player 1 (default 60)
//   --arena           openArena() around the party (pillars + torches)
// Output
//   --screen          write the blitted screen canvas instead of the view buffer
//   --sw W --sh H     screen canvas size (default 1360x800)
//   --layer light     write the light canvas alone (lightC, once step 4 lands)
//   --crop x,y,w,h    crop (in source pixels) before zoom
//   --downsample K    box-filter by K (e.g. 2 to bring a DEN=2 buffer to 1 px/unit)
//   --zoom Z          nearest upscale by Z
//   --compare ref.png print mean/max abs diff + % pixels over 8/255 vs ref; exit 1 if
//   --tol T           mean > T (default 2.0)
// Experimental patches (pre-landing previews; they exit 2 once their anchors are gone)
//   --d2              density patch: 2 buffer px per world unit via one setTransform (step 3)
//   --hero2           + a den-2 hero (proves the sprite density convention; needs --d2 anchors)
//   --light           + the quarter-res additive light-layer prototype (implies --d2) (step 4)
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PixCanvas,readPng} from './pixcanvas.mjs';
import {bootPix,resolveFile,extractScript,applyInject,rep,parseArgs,writePng,downsample,upscale,comparePng} from './pixboot.mjs';

const BOOL=new Set(['lava','gems','arena','screen','d2','hero2','light','help']);

const HERO2_ROWS=["........KKKKKKKK........","......KKPPPPPPPPKK......","....KKPPPPPPPPPPPPKK....","...KPPPPPPPPPPPPPPPPK...","...KPPPPSSSSSSSSPPPPK...","..KPPPSSKKKKKKKKSSPPPK..","..KPPSKKWWWWWWWWKKSPPK..","..KPPSKWWWWWWWWWWKSPPK..","..KPPSKWWHWWWWHWWKSPPK..","..KPPSKWWWWWWWWWWKSPPK..","..KPPSKKWWWWWWWWKKSPPK..","..KPPPSKKKKKKKKKKSPPPK..","..KPPPPSSSSSSSSSSPPPPK..",".KPPPPPPPPPPPPPPPPPPPPK.",".KPPPGGPPPPPPPPPPGGPPPK.",".KPPPGGPPPPPPPPPPGGPPPK.",".KPPPPPPPPPPPPPPPPPPPPK.","..KPPPPPPPPPPPPPPPPPPK..","..KSSPPPPPPPPPPPPPPSSK..","...KSSSPPPPPPPPPPSSSK...","....KKSSSSSSSSSSSSKK....","......KKKKKKKKKKKK......","........KOOOOOOK........","........KKKKKKKK........"];

function patchExperimental(src,o){
  const R=(a,b)=>{src=rep(src,a,b);};
  if(o.d2||o.light){
    R("const ctx=view.getContext('2d');","const ctx=view.getContext('2d');\nconst D=2; // buffer pixels per world unit");
    R("if(view.width!==vw||view.height!==vh){view.width=vw;view.height=vh;}\n  ctx.imageSmoothingEnabled=false;",
      "if(view.width!==vw*D||view.height!==vh*D){view.width=vw*D;view.height=vh*D;}\n  ctx.setTransform(D,0,0,D,0,0);ctx.imageSmoothingEnabled=false;");
    R("sctx.drawImage(view,sx,sy,sw,sh,0,0,screenC.width,screenC.height);","sctx.drawImage(view,sx*D,sy*D,sw*D,sh*D,0,0,screenC.width,screenC.height);");
  }
  if(o.hero2){
    R("function makeSprite(rows,pal){\n  const w=rows[0].length,h=rows.length;\n  const c=document.createElement('canvas');c.width=w;c.height=h;",
      "function makeSprite(rows,pal,den){\n  const w=rows[0].length,h=rows.length;\n  const c=document.createElement('canvas');c.width=w;c.height=h;\n  c.den=den||1;c.uw=w/c.den;c.uh=h/c.den;");
    R("g.drawImage(spr,Math.round(x-spr.width*s/2),Math.round(y-spr.height*s/2),Math.round(spr.width*s),Math.round(spr.height*s));",
      "const uw=spr.uw||spr.width,uh=spr.uh||spr.height;\n  g.drawImage(spr,Math.round(x-uw*s/2),Math.round(y-uh*s/2),Math.round(uw*s),Math.round(uh*s));");
    R("const yy=y-((e.spr.height*s)/2-e.r)-hopY;","const yy=y-(((e.spr.uh||e.spr.height)*s)/2-e.r)-hopY;");
    R("const playerSprites=PCOLORS.map((_,i)=>makeSprite(PLAYER_ROWS,",
      "const PLAYER_ROWS2="+JSON.stringify(HERO2_ROWS)+";\nconst playerSprites=PCOLORS.map((_,i)=>makeSprite(PLAYER_ROWS2,");
    R("{P:PCOLORS[i],S:PSHADES[i],W:'#f2dfc0',K:'#101018',G:'#ffd23e'}));","{P:PCOLORS[i],S:PSHADES[i],W:'#f2dfc0',K:'#101018',G:'#ffd23e',O:'#0e0a12',H:'#ffffff'},2));");
  }
  if(o.light){
    R("const D=2; // buffer pixels per world unit",
"const D=2; // buffer pixels per world unit\nconst LD=0.5; // light layer pixels per world unit\nconst light=document.createElement('canvas');const lctx=light.getContext('2d');\nconst glowCache=new Map();\nfunction glowSprite(col,r){const k=col+'|'+r;let c=glowCache.get(k);if(c)return c;const px=Math.max(4,Math.round(r*2*LD));c=document.createElement('canvas');c.width=c.height=px;const g=c.getContext('2d');const rgb=hexRgb(col);const N=6;for(let i=0;i<N;i++){const rr=px/2*(1-i/N);g.fillStyle='rgba('+rgb+','+(0.10+0.06*i).toFixed(2)+')';g.beginPath();g.arc(px/2,px/2,rr,0,Math.PI*2);g.fill();}glowCache.set(k,c);return c;}\nlet lightN=0;\nfunction glow(x,y,r,col,a){if(lightN>700||x<-r||y<-r||x>light.width/LD+r||y>light.height/LD+r)return;lightN++;lctx.globalAlpha=a;lctx.drawImage(glowSprite(col,r),x-r,y-r,r*2,r*2);}");
    R("ctx.setTransform(D,0,0,D,0,0);ctx.imageSmoothingEnabled=false;",
"ctx.setTransform(D,0,0,D,0,0);ctx.imageSmoothingEnabled=false;\n  if(light.width!==vw*LD||light.height!==vh*LD){light.width=vw*LD;light.height=vh*LD;}\n  lctx.setTransform(LD,0,0,LD,0,0);lctx.clearRect(0,0,vw,vh);lightN=0;");
    R("drawSpriteC(ctx,g.v>=4?bigGemSprite:gemSprite,q[0],q[1]+Math.sin(g.t*4)*1.5);",
      "drawSpriteC(ctx,g.v>=4?bigGemSprite:gemSprite,q[0],q[1]+Math.sin(g.t*4)*1.5);glow(q[0],q[1],9,g.v>=4?'#ffd23e':'#39d5ff',0.35);");
    R("drawSpriteC(ctx,playerSprites[p.col],x,y-2+bobY);","drawSpriteC(ctx,playerSprites[p.col],x,y-2+bobY);glow(x,y,22,PCOLORS[p.col],0.30);");
    R("      stripes(ctx,px,py,TILE,TILE,'rgba(255,210,62,0.30)',G.time*1.5);","      stripes(ctx,px,py,TILE,TILE,'rgba(255,210,62,0.30)',G.time*1.5);if(((tx+ty)&1)===0)glow(px+8,py+8,20,'#ff5a2a',0.32);");
    R("  for(const b of G.bullets){\n    const q=W2V(b.x,b.y);\n    if(b.met){","  for(const b of G.bullets){\n    const q=W2V(b.x,b.y);\n    if(b.glow||b.star||b.met)glow(q[0],q[1],9,b.prism?prismCol(b.prism+G.time*15):b.col,0.45);\n    if(b.met){");
    R("    ctx.fillStyle=pt.prism?prismCol(pt.prism+G.time*13):pt.col;\n    if(pt.star){","    ctx.fillStyle=pt.prism?prismCol(pt.prism+G.time*13):pt.col;\n    if(pt.star||pt.spark)glow(q[0],q[1],5,ctx.fillStyle,0.35);\n    if(pt.star){");
    R("  // the cave walk's blackout sits over the world, under the HUD\n  if(G.fade>0)",
      "  ctx.globalCompositeOperation='lighter';ctx.imageSmoothingEnabled=true;ctx.drawImage(light,0,0,vw,vh);ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;\n  // the cave walk's blackout sits over the world, under the HUD\n  if(G.fade>0)");
  }
  return src;
}

// Boots, runs the sim, applies the scene flags and renders once.
// Returns {g,G,view,screen,light,vw,vh,literals}. Shared with sheet.mjs light.
export async function runFrame(o){
  const NP=+(o.np||1),seed=o.seed!==undefined?+o.seed:40+NP;
  const file=resolveFile(o.file);
  let src=extractScript(file),literals=[];
  if(o.inject){const r=await applyInject(src,String(o.inject).split(','));src=r.src;literals=r.literals;}
  if(o.d2||o.hero2||o.light){
    try{src=patchExperimental(src,o);}
    catch(e){console.error('experimental patch no longer applies ('+e.message+') — that step has landed; drop the flag');process.exit(2);}
  }
  const g=bootPix({file,src,seed,search:o.q?(o.q.startsWith('?')?o.q:'?'+o.q):'',screenW:o.sw?+o.sw:undefined,screenH:o.sh?+o.sh:undefined});
  const {ev,pads}=g;
  for(let i=0;i<NP;i++)g.addPad();
  const G=ev('G');G.state='title';
  for(let i=0;i<NP;i++)ev('joinPlayer')(i,0);
  ev('startRun')('classic');
  const update=ev('update'),updateCamera=ev('updateCamera'),takeOffer=ev('takeOffer'),finishLevelup=ev('finishLevelup');
  const SCHOOL_IDS=g.has('SCHOOL_IDS')?ev('SCHOOL_IDS'):[];
  const school=o.school||null;
  if(school&&!SCHOOL_IDS.includes(school)){console.error('unknown school '+school+'; have '+SCHOOL_IDS.join('|'));process.exit(2);}
  const dt=1/60,wantWave=o.wave?+o.wave:0,maxF=+(o.max||90000),settle=+(o.settle||240);
  let frames=wantWave?maxF:+(o.frames||420),settling=-1,f=0;
  for(;f<frames;f++){
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
    if(G.state==='levelup'){
      for(const pick of G.levelupPicks)if(!pick.done){
        if(school&&pick.offers.length&&pick.offers[0].kind==='school')pick.sel=SCHOOL_IDS.indexOf(school);
        takeOffer(pick,true);
      }
      if(G.levelupPicks.every(p=>p.done))finishLevelup();
      continue;
    }
    const a=G.time*0.55;
    for(const p of G.players){const pad=pads[p.padIndex];pad.axes[0]=Math.cos(a+p.idx*Math.PI/2);pad.axes[1]=Math.sin(a+p.idx*Math.PI/2)*0.6;}
    update(dt);updateCamera(dt);
    if(wantWave){
      if(settling<0&&G.wave>=wantWave)settling=settle;
      if(settling>=0&&--settling<0)break;
    }
    if(G.state==='victory'||G.state==='gameover')break;
  }
  if(school){
    // the kit through the draft path: one synthetic pick per card
    const SCHOOLS=ev('SCHOOLS'),WEAPONS=ev('WEAPONS'),PASSIVES=ev('PASSIVES'),sc=SCHOOLS[school],lv=+(o['kit-lv']||3);
    const take=(p,offer)=>takeOffer({p,offers:[offer],sel:0,done:false,openT:0},true);
    for(const p of G.players){
      p.school=school;
      const ids=['blaster',...sc.actives];if(G.bossKills>0)ids.push(sc.ult);
      for(const id of ids){
        if(!p.weapons[id])take(p,{kind:'new',id});
        while(p.weapons[id].lv<Math.min(lv,WEAPONS[id].max))take(p,{kind:'up',id});
      }
      for(const pid of sc.passives)while((p.pas[pid]||0)<PASSIVES[pid].ranks)take(p,{kind:'pas',id:pid});
    }
  }
  if(o.biome)ev('setBiome')(o.biome);
  if(o.terrain)ev('setTerrain')(o.terrain==='null'?null:o.terrain);
  if(o.arena)ev('openArena')();
  if(o.lava){G.lava=new Set();const p=G.players[0];for(let i=-14;i<14;i++){const tx=Math.floor(p.x/16)+i,ty=Math.floor(p.y/16)+3+Math.round(Math.sin(i*0.5)*2);for(let w=0;w<3;w++)G.lava.add(tx+','+(ty+w));}}
  if(o.bossnear&&G.boss){const p=G.players[0];G.boss.x=p.x+(+o.bossnear||60);G.boss.y=p.y-8;} // drag the live boss beside player 1
  if(o.gems){const p=G.players[0];for(let i=0;i<12;i++)G.gems.push({x:p.x+Math.cos(i)*60*(1+i%3),y:p.y+Math.sin(i*1.7)*40*(1+i%2),v:i%5===0?4:1,t:i,dead:false});}
  G.shake=0;
  const t0=Date.now();ev('render')();
  const view=ev('view');
  const light=g.has('lightC')?ev('lightC'):(g.has('light')&&ev('typeof light==="object"&&light&&light.width!==undefined')?ev('light'):null);
  console.log('render ms',Date.now()-t0,'frames',f,'state',G.state,'wave',G.wave,'level',G.level,'enemies',G.enemies.filter(e=>!e.dead).length,'cam',Math.round(G.cam.w),'biome',G.biome,'DEN',g.has('DEN')?ev('DEN'):'(none)');
  console.log('view',view.width+'x'+view.height,'screen',g.screen.width+'x'+g.screen.height,light?'light '+light.width+'x'+light.height:'');
  return {g,G,ev,view,screen:g.screen,light,literals};
}

// crop / downsample / zoom pipeline shared by the tools
export function finish(srcC,o){
  let c=srcC;
  if(o.crop){const [x,y,w,h]=String(o.crop).split(',').map(Number);const cc=new PixCanvas(w,h);cc.getContext('2d').drawImage(srcC,x,y,w,h,0,0,w,h);c=cc;}
  if(o.downsample&&+o.downsample>1)c=downsample(c,+o.downsample);
  if(o.zoom&&+o.zoom>1)c=upscale(c,+o.zoom);
  return c;
}
export function compareOut(c,o){
  if(!o.compare)return 0;
  const ref=readPng(fs.readFileSync(path.resolve(o.compare)));
  const r=comparePng(c,ref);
  if(r.error){console.log('compare FAIL',r.error);return 1;}
  const tol=o.tol!==undefined?+o.tol:2.0;
  console.log('compare vs',path.resolve(o.compare),'mean',r.mean.toFixed(3),'max',r.max.toFixed(1),'pctOver8',r.pctOver8.toFixed(3)+'%','tol',tol,r.mean>tol?'FAIL':'ok');
  return r.mean>tol?1:0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(0);}
  const out=o._[0]||o.out||'frame.png';
  const r=await runFrame(o);
  let srcC=o.screen?r.screen:r.view;
  if(o.layer==='light'){if(!r.light){console.error('no light canvas in this file (lightC lands at step 4)');process.exit(2);}srcC=r.light;}
  const c=finish(srcC,o);
  writePng(c,out);
  if(r.literals.length)console.log('injected',r.literals.length,'const(s)');
  process.exit(compareOut(c,o));
}
