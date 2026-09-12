// Hero (mage) generator (2026-09-12): the player characters as one rig on
// mobgen.mjs, 24x24 texels at den 2 (12x12 units, FAMILIES.hero, drawn at y-2).
// A robed mage: the robe is the player colour (P/S/H per PCOLORS, the only
// saturated thing on screen), everything else is shared (HERO_PAL). One rig,
// four schools (silhouette + staff head + trim):
//   base      pointed hat, arcane orb staff, gold sash     (no path picked yet)
//   destro    pointed hat with upturned brim horns, flame staff, ember sash
//   illusion  hood, crystal staff, lilac sash
//   necro     hood over a shadowed face with rot-green eyes, skull staff, tattered hem
// Four facings (side mirrored for right, rule 48) x 4 walk frames (feet swing,
// 1 px bob, rules 46/47/51) + 4 idle frames (breathing bob, orb pulse, rule 50).
//   node tools/art/hero-gen.mjs [school] [facing] [frame]   prints rows (frame 4-7 = idle)
import {render,mirror} from './mobgen.mjs';

// shared letters: K outline (MAT.hero K), W face, O hood/face shadow, G gold, T/U staff
// wood, V/X the arcane orb, E ember, Y flame core, C/A crystal, N/D rot green, B bone
export const HERO_PAL={K:'#101018',W:'#f2dfc0',O:'#1a1428',G:'#ffd23e',T:'#6a4a2c',U:'#3a2416',V:'#c04aff',X:'#e8d5ff',
  E:'#ff7a1f',Y:'#ffe08a',C:'#7fd8ff',A:'#c9a4ff',N:'#9fe84a',D:'#3a5a2a',B:'#e8dcc0'};
export const PCOLORS=['#4cc2ff','#ff9040','#57e86b','#ff6bd6','#ff4d4d','#f5e34a','#b48bff','#e8ecf2'];
export const PSHADES=['#2a7fb5','#b55e1f','#2f9c44','#b53f96','#b32a2a','#ab9c26','#7a55b5','#9aa2ad'];
const mix=(a,b,t)=>{const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);const c=[16,8,0].map(s=>Math.round(((A>>s)&255)*(1-t)+((B>>s)&255)*t));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');};
// per-player highlight: the robe colour pushed toward warm white (rule 19)
export const PHIGH=PCOLORS.map(c=>mix(c,'#fff6e0',0.45));
export const SCHOOLS=['base','destro','illusion','necro'];

export function mage(o={}){
  const w=24,h=24,cx=12,sc=o.school||'base';
  const hood=sc==='illusion'||sc==='necro';
  const trim={base:'G',destro:'E',illusion:'A',necro:'N'}[sc];
  return {
    w,h,frames:8,K:'K',ramp:'SPH',rim:true,
    mats:{robe:{D:'S',M:'P',L:'P',H:'H'},lit:'P',dark:'S',face:'W',shadow:'O',trim,wood:'T',orb:{D:'V',M:'V',L:'X',H:'X'}},
    parts(facing,f){
      const idle=f>=4,i=f%4;
      const bob=idle?[0,0,1,1][i]:[0,-1,0,-1][i];   // walk: passing frames stand 1 px taller; idle: a slow sink
      const s=idle?0:[1,0,-1,0][i];                 // which foot leads
      const pulse=idle?[1,1,0,1][i]:1;              // orb core on/off
      const P=[];
      // staff head: stamps around the tip at (sx,2+bob)
      const staffHead=(x,y)=>{
        if(sc==='destro'){ // a flame: ember tongue with a pale core, licking to one side
          P.push({kind:'px',z:6,pts:[[x,y-2,'E'],[x+1,y-2,'E'],[x-1,y-1,'E'],[x,y-1,'Y'],[x+1,y-1,'E'],[x-1,y,'E'],[x,y,'Y'],[x+1,y,'Y'],[x,y+1,'E'],[x+1,y+1,'E']]});
          if(pulse)P.push({kind:'px',z:7,pts:[[x+1,y-2,'Y']]});
        }else if(sc==='illusion'){ // a crystal: a diamond with a white spark
          P.push({kind:'px',z:6,pts:[[x,y-2,'C'],[x-1,y-1,'C'],[x,y-1,pulse?'X':'C'],[x+1,y-1,'A'],[x-1,y,'A'],[x,y,'C'],[x+1,y,'A'],[x,y+1,'A']]});
        }else if(sc==='necro'){ // a skull: bone with two hollow eyes
          P.push({kind:'px',z:6,pts:[[x-1,y-2,'B'],[x,y-2,'B'],[x+1,y-2,'B'],[x-1,y-1,'K'],[x,y-1,'B'],[x+1,y-1,'K'],[x-1,y,'B'],[x,y,'B'],[x+1,y,'B'],[x,y+1,'B']]});
          if(pulse)P.push({kind:'px',z:7,pts:[[x-1,y-1,'N'],[x+1,y-1,'N']]});
        }else{ // the arcane orb
          P.push({kind:'ellipse',tag:'orb',cx:x+0.5,cy:y+0.5,rx:1.6,ry:1.6,mat:'orb',z:6,lit:0.2});
          if(pulse)P.push({kind:'px',z:7,pts:[[x,y,'X']]});
        }
      };
      const legs=(xl,xr,zl,zr)=>{
        P.push({kind:'limb',tag:'leg',x0:xl,y0:18+bob,x1:xl,y1:h-1-(s<0?1:0),w0:3,w1:3,mat:'dark',z:zl,sep:false});
        P.push({kind:'limb',tag:'leg',x0:xr,y0:18+bob,x1:xr,y1:h-1-(s>0?1:0),w0:3,w1:3,mat:'dark',z:zr,sep:false});
      };
      const headAt=(hx,rx,profile)=>{
        if(hood){
          // hood: a rounded cowl over the head, peaked, face set back in its shadow
          P.push({kind:'limb',tag:'hood',x0:hx+(profile?-0.5:0.5),y0:3+bob,x1:hx,y1:6+bob,w0:1,w1:6,mat:'robe',z:5,fade:-0.1,lit:0.15,sep:false});
          P.push({kind:'ellipse',tag:'hood',cx:hx,cy:9+bob,rx:rx+1.2,ry:3.9,mat:'robe',z:5,lit:-0.15,ky:0.9});
          if(sc==='necro'){
            P.push({kind:'ellipse',tag:'face',cx:hx,cy:10.5+bob,rx:rx-0.9,ry:2.1,mat:'shadow',z:6,outline:false});
            const ex=Math.round(hx);
            P.push({kind:'px',z:9,pts:profile?[[ex-2,10+bob,'N'],[ex-2,11+bob,'N']]:[[ex-2,10+bob,'N'],[ex-2,11+bob,'N'],[ex+1,10+bob,'N'],[ex+1,11+bob,'N']]});
          }else{
            P.push({kind:'ellipse',tag:'face',cx:hx,cy:10.6+bob,rx:rx-0.9,ry:2.1,mat:'face',z:6,outline:false});
            const ex=Math.round(hx);
            P.push({kind:'px',z:8,pts:[[ex-2,9+bob,'O'],[ex-1,9+bob,'O'],[ex,9+bob,'O'],[ex+1,9+bob,'O']]});
            P.push({kind:'px',z:9,pts:profile?[[ex-2,10+bob,'K'],[ex-2,11+bob,'K']]:[[ex-2,10+bob,'K'],[ex-2,11+bob,'K'],[ex+1,10+bob,'K'],[ex+1,11+bob,'K']]});
          }
        }else{
          // face under the brim: shadow row, then 1x2 eyes; a hat cone with a bent tip and a flat brim
          P.push({kind:'ellipse',tag:'head',cx:hx,cy:10.5+bob,rx,ry:2.8,mat:'face',z:4,lit:0});
          const ex=Math.round(hx);
          P.push({kind:'px',z:8,pts:[[ex-3,8+bob,'O'],[ex-2,8+bob,'O'],[ex-1,8+bob,'O'],[ex,8+bob,'O'],[ex+1,8+bob,'O'],[ex+2,8+bob,'O']]});
          P.push({kind:'px',z:9,pts:profile?[[ex-2,10+bob,'K'],[ex-2,11+bob,'K']]:[[ex-2,10+bob,'K'],[ex-2,11+bob,'K'],[ex+1,10+bob,'K'],[ex+1,11+bob,'K']]});
          P.push({kind:'limb',tag:'hat',x0:hx+(profile?-1.5:1),y0:1+bob,x1:hx-0.5,y1:6+bob,w0:1,w1:profile?8:9,mat:'robe',z:5,fade:-0.1,lit:0.15,sep:false});
          const bw=profile?12:14,bx=Math.round(hx-bw/2);
          P.push({kind:'rect',tag:'brim',x:bx,y:7+bob,w:bw,h:1,mat:'lit',z:5.5,sep:false});
          if(sc==='destro')P.push({kind:'px',z:5.6,pts:[[bx,6+bob,'P'],[bx+bw-1,6+bob,'P'],[bx,5+bob,'S'],[bx+bw-1,5+bob,'S']]}); // brim horns
        }
      };
      // necro: the robe stops a row short and rags of two widths hang from it at uneven spacing, so the
      // silhouette itself is torn (gaps show the boots) and the outline follows the rags (rule 15)
      const hemY=sc==='necro'?19:20;
      const hem=(x0,x1)=>{ if(sc!=='necro')return; const rags=[[0,3,3],[4,2,2],[7,3,3],[11,2,2],[14,3,3]];
        for(const [dx,w,h] of rags){const x=x0+dx;if(x+w-1>x1)continue;P.push({kind:'rect',tag:'robe',x,y:hemY+bob+1,w,h,mat:'lit',z:2.1,sep:false});} };
      if(facing==='down'||facing==='up'){
        const up=facing==='up',sx=up?1:-1; // staff hand: the character's right = the sprite's left when facing down
        legs(cx-3,cx+2,1,1);
        P.push({kind:'limb',tag:'robe',noSep:['leg'],x0:cx-0.5,y0:13+bob,x1:cx-0.5,y1:hemY+bob,w0:9,w1:15,mat:'robe',z:2,fade:0.15,lit:-0.15});
        hem(cx-7,cx+7);
        P.push({kind:'rect',tag:'sash',x:cx-5,y:16+bob,w:10,h:1,mat:'trim',z:2.5,sep:false});
        P.push({kind:'px',z:2.6,pts:[[cx-1,16+bob,'K'],[cx,17+bob,trim]]});
        // sleeves as value steps on the robe (rule 16): a dark sleeve on the lit side, a lit sleeve on the shadow side
        const freeX=-sx,stX=sx;
        P.push({kind:'limb',tag:'arm',x0:cx+4.5*freeX,y0:13+bob,x1:cx+6.5*freeX,y1:18+bob+s,w0:3,w1:2,mat:freeX<0?'dark':'lit',z:3,sep:false});
        P.push({kind:'limb',tag:'arm',x0:cx+4.5*stX,y0:13+bob,x1:cx+6.5*stX,y1:17+bob,w0:3,w1:2,mat:stX<0?'dark':'lit',z:3,sep:false});
        const stx=Math.round(cx+7.5*sx);
        P.push({kind:'rect',tag:'staff',x:stx,y:4+bob,w:1,h:16,mat:'wood',z:up?1.5:3.5});
        staffHead(stx,2+bob);
        if(up){ // from behind: the back of the hood or hat, no face
          if(hood){P.push({kind:'limb',tag:'hood',x0:cx-0.5,y0:3+bob,x1:cx-0.5,y1:6+bob,w0:1,w1:6,mat:'robe',z:5,fade:-0.1,lit:0.15,sep:false});
            P.push({kind:'ellipse',tag:'hood',cx,cy:9+bob,rx:4.8,ry:3.9,mat:'robe',z:5,lit:0.1,ky:0.9});}
          else{P.push({kind:'ellipse',tag:'head',cx,cy:10.5+bob,rx:3.6,ry:2.8,mat:'dark',z:4});
            P.push({kind:'limb',tag:'hat',x0:cx+1,y0:1+bob,x1:cx-0.5,y1:6+bob,w0:1,w1:9,mat:'robe',z:5,fade:-0.1,lit:0.2,sep:false});
            P.push({kind:'rect',tag:'brim',x:cx-7,y:7+bob,w:14,h:1,mat:'lit',z:5.5,sep:false});
            if(sc==='destro')P.push({kind:'px',z:5.6,pts:[[cx-7,6+bob,'P'],[cx+6,6+bob,'P'],[cx-7,5+bob,'S'],[cx+6,5+bob,'S']]});}
        }else headAt(cx,3.6,false);
      }else{ // left profile: hat/hood and face toward the left, staff in the near hand in front
        legs(cx-2-s,cx+2+s,1,0.5);
        P.push({kind:'limb',tag:'robe',noSep:['leg'],x0:cx+0.5,y0:13+bob,x1:cx+0.5,y1:hemY+bob,w0:7,w1:12,mat:'robe',z:2,fade:0.15,lit:-0.15});
        hem(cx-5,cx+6);
        P.push({kind:'rect',tag:'sash',x:cx-3,y:16+bob,w:7,h:1,mat:'trim',z:2.5,sep:false});
        P.push({kind:'limb',tag:'arm',x0:cx-1,y0:13+bob,x1:cx-4,y1:17+bob,w0:3,w1:2,mat:'dark',z:3,sep:false});
        const stx=cx-6;
        P.push({kind:'rect',tag:'staff',x:stx,y:4+bob,w:1,h:16,mat:'wood',z:3.5});
        staffHead(stx,2+bob);
        headAt(cx-0.5,3.3,true);
        // the back of the head sits in shadow
        P.push({kind:'px',z:8.5,pts:[[cx+1,9+bob,'O'],[cx+2,10+bob,'O'],[cx+2,11+bob,'O'],[cx+1,12+bob,'O']]});
      }
      return P;
    }
  };
}
// {walk:{down,up,left,right:[rows x4]}, idle:{...}} for one school
export function heroSheet(school){
  const rig=mage({school}),out={walk:{},idle:{}};
  for(const f of ['down','up','left']){
    out.walk[f]=[0,1,2,3].map(i=>render(rig,f,i));
    out.idle[f]=[4,5,6,7].map(i=>render(rig,f,i));
  }
  out.walk.right=out.walk.left.map(mirror);out.idle.right=out.idle.left.map(mirror);
  return out;
}

if(process.argv[1]&&process.argv[1].replace(/\\/g,'/').endsWith('hero-gen.mjs')){
  const rig=mage({school:process.argv[2]||'base'}),want=process.argv[3];
  for(const f of want?[want]:['down','left','up']){console.log(f);console.log(render(rig,f,+(process.argv[4]||0)).join('\n'));}
}
