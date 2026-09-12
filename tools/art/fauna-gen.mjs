// Volcano fauna generator (2026-09-11): rigs for the Slagmaw kin, built on mobgen.mjs
// like horde-gen.mjs. Fauna keep the Slagmaw ember colour contract: a basalt-crust
// body ramp (grey, lifted a step off the ground so it reads on basalt) with lava seams
// and ember eyes in the boss's own accents (R #7a1a0a dark lava, O #ff7a1f, Y #ffd23e,
// W #fff6d6), which keeps them apart from the charred horde roster.
//   node tools/art/fauna-gen.mjs smasher [frame]   prints the down/left/up rows
import {rigToSheet,render} from './mobgen.mjs';

export const FAUNA_PAL={K:'#120c0c',D:'#352c2b',M:'#554846',L:'#75665f',H:'#978a80',R:'#7a1a0a',O:'#ff7a1f',Y:'#ffd23e',W:'#fff6d6'};

// smasher = slag brute: squat and wide, a crust of basalt plates on the back split by
// lava seams, two hammer fists the size of its head, short legs. o.cast: the fists are
// raised overhead and the seams flare (the Molten Slam wind-up; the game adds the hop).
export function brute(o={}){
  const w=o.w||28,h=o.h||28,sx=w/28,sy=h/28;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2,cast=!!o.cast;
  const bobOf=f=>cast?[0,0,-1,-1][f%4]:[0,-1,0,-1][f%4];
  const swing=f=>cast?0:[1,0,-1,0][f%4];
  const seamHot=f=>cast&&f%4>=2;                          // the last two cast frames glow Y
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'}},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f),hot=seamHot(f)?'Y':'O';
      const P=[];
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        // short legs, wide stance
        P.push({kind:'limb',tag:'leg',x0:cx-X(5),y0:Y(21)+bob,x1:cx-X(5.5),y1:h-1-(s<0?1:0),w0:X(4),w1:X(4),mat:'body',z:1,fade:0.5,lit:0.1});
        P.push({kind:'limb',tag:'leg',x0:cx+X(5),y0:Y(21)+bob,x1:cx+X(5.5),y1:h-1-(s>0?1:0),w0:X(4),w1:X(4),mat:'body',z:1,fade:0.5,lit:-0.15});
        // the body: a wide low boulder; the back crust rises behind the head as a lighter dome
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx,cy:Y(16)+bob,rx:X(10),ry:Y(7),mat:'body',z:2,lit:up?0.15:-0.05,ky:up?0.5:0.7,kx:0.3});
        P.push({kind:'ellipse',tag:'crust',cx,cy:Y(10.5)+bob,rx:X(9),ry:Y(4.5),mat:'body',z:2.5,lit:0.3,ky:0.9,kx:0.3,sep:false});
        // lava seams across the crust: three short cracks, hot at the centre
        const sy0=Math.round(Y(9))+bob;
        P.push({kind:'px',z:8,pts:[[cx-6,sy0+1,'R'],[cx-5,sy0,hot],[cx-4,sy0,'R'],[cx-1,sy0-1,'R'],[cx,sy0-1,hot],[cx+1,sy0-1,hot],[cx+2,sy0,'R'],[cx+4,sy0+1,'R'],[cx+5,sy0,hot],[cx+6,sy0+1,'R']]});
        // fists: hanging at the sides on the walk, raised overhead on the cast
        const armZ=up?1.5:3;
        for(const sgn of [-1,1]){
          const lit=sgn<0?0.15:-0.1,sw=sgn<0?s:-s;
          if(cast){
            P.push({kind:'limb',tag:'arm',x0:cx+sgn*X(9),y0:Y(13)+bob,x1:cx+sgn*X(9),y1:Y(5)+bob,w0:X(4),w1:X(4),mat:'body',z:armZ,fade:-0.3,lit});
            P.push({kind:'ellipse',tag:'fist',cx:cx+sgn*X(8.5),cy:Y(4)+bob,rx:X(4.5),ry:Y(3.5),mat:'body',z:armZ+0.1,lit:lit+0.1,ky:0.8,kx:0.4});
            P.push({kind:'px',z:9,pts:[[Math.round(cx+sgn*X(8.5))-1,Math.round(Y(4))+bob,'R'],[Math.round(cx+sgn*X(8.5)),Math.round(Y(4))+bob,hot],[Math.round(cx+sgn*X(8.5))+1,Math.round(Y(4))+bob,'R']]});
          }else{
            P.push({kind:'limb',tag:'arm',x0:cx+sgn*X(9.5),y0:Y(13)+bob,x1:cx+sgn*X(10),y1:Y(20)+sw,w0:X(4),w1:X(4),mat:'body',z:armZ,fade:0.4,lit});
            P.push({kind:'ellipse',tag:'fist',cx:cx+sgn*X(9.5),cy:Y(22.5)+sw,rx:X(4.5),ry:Y(3.5),mat:'body',z:armZ+0.1,lit:lit-0.05,ky:0.7,kx:0.4});
            P.push({kind:'px',z:9,pts:[[Math.round(cx+sgn*X(9.5))-1,Math.round(Y(22.5))+sw,'R'],[Math.round(cx+sgn*X(9.5)),Math.round(Y(22.5))+sw,'O'],[Math.round(cx+sgn*X(9.5))+1,Math.round(Y(22.5))+sw,'R']]});
          }
        }
        // head: a blunt wedge low in front of the crust
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(up?9:13.5)+bob,rx:X(5),ry:Y(3.5),mat:'body',z:up?2.2:4,lit:up?0.25:0,ky:up?0.5:0.8});
        if(!up){
          const ey=Math.round(Y(13))+bob,l=Math.round(cx-X(3.5)),r=Math.round(cx+X(1.5));
          P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K'],[r+2,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[l,ey+1,'O'],[l+1,ey+1,'O'],[r,ey,'W'],[r+1,ey,'O'],[r,ey+1,'O'],[r+1,ey+1,'O']]});
          P.push({kind:'px',z:9,pts:[[l,ey+3,'K'],[l+1,ey+3,'K'],[l+2,ey+3,'K'],[l+3,ey+3,'K'],[l+4,ey+3,'K'],[l+5,ey+3,'K']]});
        }
      }else{ // left: profile, crust hump at the back, head low forward, the near fist in front
        P.push({kind:'limb',tag:'leg',x0:cx+X(3),y0:Y(21)+bob,x1:cx+X(3)+s*X(1.5),y1:h-1-(s<0?1:0),w0:X(4),w1:X(4),mat:'body',z:0.5,fade:0.5,lit:-0.15});
        P.push({kind:'limb',tag:'leg',x0:cx-X(3),y0:Y(21)+bob,x1:cx-X(3)-s*X(1.5),y1:h-1-(s>0?1:0),w0:X(4),w1:X(4),mat:'body',z:1,fade:0.5,lit:0.1});
        // far fist behind
        if(cast){P.push({kind:'ellipse',tag:'fist',cx:cx+X(3),cy:Y(4.5)+bob,rx:X(4),ry:Y(3.5),mat:'body',z:1.5,lit:-0.35,ky:0.8});}
        else{P.push({kind:'ellipse',tag:'fist',cx:cx+X(6),cy:Y(22.5)-s,rx:X(4),ry:Y(3.5),mat:'body',z:1.5,lit:-0.35,ky:0.7});}
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx:cx+X(1),cy:Y(16)+bob,rx:X(9),ry:Y(7),mat:'body',z:2,lit:-0.05,ky:0.7,kx:0.5});
        P.push({kind:'ellipse',tag:'crust',cx:cx+X(3),cy:Y(10.5)+bob,rx:X(7.5),ry:Y(4.5),mat:'body',z:2.5,lit:0.3,ky:0.9,kx:0.5,sep:false});
        const sy0=Math.round(Y(9))+bob,sc=Math.round(cx+X(3));
        P.push({kind:'px',z:8,pts:[[sc-4,sy0+1,'R'],[sc-3,sy0,hot],[sc-2,sy0,'R'],[sc+1,sy0-1,'R'],[sc+2,sy0-1,hot],[sc+3,sy0,'R'],[sc+5,sy0+1,'R']]});
        // near arm and fist
        if(cast){
          P.push({kind:'limb',tag:'arm',x0:cx-X(4),y0:Y(13)+bob,x1:cx-X(6),y1:Y(6)+bob,w0:X(4),w1:X(4),mat:'body',z:3,fade:-0.3,lit:0.15});
          P.push({kind:'ellipse',tag:'fist',cx:cx-X(6.5),cy:Y(4.5)+bob,rx:X(4.5),ry:Y(3.5),mat:'body',z:3.1,lit:0.2,ky:0.8,kx:0.4});
          P.push({kind:'px',z:9,pts:[[Math.round(cx-X(6.5))-1,Math.round(Y(4.5))+bob,'R'],[Math.round(cx-X(6.5)),Math.round(Y(4.5))+bob,hot],[Math.round(cx-X(6.5))+1,Math.round(Y(4.5))+bob,'R']]});
        }else{
          P.push({kind:'limb',tag:'arm',x0:cx-X(4),y0:Y(14)+bob,x1:cx-X(8),y1:Y(20)+s,w0:X(4),w1:X(4),mat:'body',z:3,fade:0.4,lit:0.15});
          P.push({kind:'ellipse',tag:'fist',cx:cx-X(8.5),cy:Y(22.5)+s,rx:X(4.5),ry:Y(3.5),mat:'body',z:3.1,lit:0.1,ky:0.7,kx:0.4});
          P.push({kind:'px',z:9,pts:[[Math.round(cx-X(8.5))-1,Math.round(Y(22.5))+s,'R'],[Math.round(cx-X(8.5)),Math.round(Y(22.5))+s,'O'],[Math.round(cx-X(8.5))+1,Math.round(Y(22.5))+s,'R']]});
        }
        P.push({kind:'ellipse',tag:'head',cx:cx-X(5.5),cy:Y(13.5)+bob,rx:X(5),ry:Y(3.4),mat:'body',z:4,lit:0,ky:0.8,kx:0.6});
        const ey=Math.round(Y(13))+bob,l=Math.round(cx-X(8.5));
        P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[l+2,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[l,ey+1,'O'],[l+1,ey+1,'O']]});
        P.push({kind:'px',z:9,pts:[[l-1,ey+3,'K'],[l,ey+3,'K'],[l+1,ey+3,'K'],[l+2,ey+3,'K'],[l+3,ey+3,'K']]});
      }
      return P;
    }
  };
}

// burster = slag tick: a round crust-shelled ember creature on four stubby legs, gold
// cracks radiating from its core (VOLC.burst is gold: the pop it teaches), two ember
// eyes at the front. o.swell: the cracks widen and whiten frame by frame (the game also
// scales the sprite 1 -> 1.7 over the 0.9 s fuse). 24x24 for r=5, feet on the bottom row.
export function tick(o={}){
  const w=o.w||24,h=o.h||24,sx=w/24,sy=h/24;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2,swell=!!o.swell;
  const bobOf=f=>swell?0:[0,-1,0,-1][f%4];
  const swing=f=>swell?0:[1,0,-1,0][f%4];
  const cracks=(ccx,ccy,k,P)=>{ // k 0..3: length and heat of the cracks
    const arms=[[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,1],[-1,-1],[1,1]];
    const pts=[[ccx,ccy,k>=2?'W':'Y']];
    arms.forEach(([dx,dy],i)=>{const len=(i<4?2:1)+(k>=1?1:0)+(k>=3?1:0);for(let j=1;j<=len;j++)pts.push([ccx+dx*j,ccy+dy*j,j===1&&k>=2?'W':j<=2?'Y':'O']);});
    P.push({kind:'px',z:8,pts});
  };
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'}},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f),k=f%4;
      const P=[];
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        for(const [dx,lead] of [[-6,1],[-3,-1],[3,1],[6,-1]]){
          P.push({kind:'limb',tag:'leg',x0:cx+X(dx),y0:Y(18)+bob,x1:cx+X(dx*1.15),y1:h-1-(s*lead<0?1:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.5,lit:dx<0?0.1:-0.1});
        }
        const rx=swell?8.5+k*0.4:8.5,ry=swell?7+k*0.3:7;
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx,cy:Y(12.5)+bob,rx:X(rx),ry:Y(ry),mat:'body',z:2,lit:up?0.1:-0.1,ky:0.7,kx:0.3});
        P.push({kind:'ellipse',tag:'crust',cx,cy:Y(9.5)+bob,rx:X(rx-1.5),ry:Y(4),mat:'body',z:2.5,lit:0.3,ky:0.9,kx:0.3,sep:false});
        cracks(Math.round(cx)-1,Math.round(Y(11))+bob,swell?k:0,P);
        if(!up){
          const ey=Math.round(Y(15))+bob,l=Math.round(cx-X(4)),r=Math.round(cx+X(2));
          P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[l,ey+1,'O'],[l+1,ey+1,'O'],[r,ey,'W'],[r+1,ey,'O'],[r,ey+1,'O'],[r+1,ey+1,'O']]});
        }
      }else{
        for(const [dx,lead] of [[-5,1],[-1.5,-1],[2,1],[5.5,-1]]){
          P.push({kind:'limb',tag:'leg',x0:cx+X(dx),y0:Y(18)+bob,x1:cx+X(dx)+s*lead*X(1),y1:h-1-(s*lead<0?1:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.5,lit:0});
        }
        const rx=swell?8.5+k*0.4:8.5,ry=swell?7+k*0.3:7;
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx:cx+X(0.5),cy:Y(12.5)+bob,rx:X(rx),ry:Y(ry),mat:'body',z:2,lit:-0.1,ky:0.7,kx:0.5});
        P.push({kind:'ellipse',tag:'crust',cx:cx+X(1.5),cy:Y(9.5)+bob,rx:X(rx-2),ry:Y(4),mat:'body',z:2.5,lit:0.3,ky:0.9,kx:0.5,sep:false});
        cracks(Math.round(cx+X(1)),Math.round(Y(11))+bob,swell?k:0,P);
        const ey=Math.round(Y(14))+bob,l=Math.round(cx-X(7));
        P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[l,ey+1,'O'],[l+1,ey+1,'O']]});
      }
      return P;
    }
  };
}

// fireslug = lava slug: a long molten body under a basalt-crust shell, the lava belly
// oozing out below and behind it (it drips lava as it goes), two eye stalks with ember
// eyes at the front. Crawl frames stretch and contract the belly (rule 46 for a slug)
// and sway the stalks. 32x24 for r=6, side view is the long one, feet on the bottom row.
export function slug(o={}){
  const w=o.w||32,h=o.h||24,sx=w/32,sy=h/24;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  const stretch=f=>[0,1,0,-1][f%4];
  const sway=f=>[0,1,0,-1][f%4];
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'},lava:{D:'R',M:'O',L:'Y',H:'W'}},
    parts(facing,f){
      const st=stretch(f),sw=sway(f);
      const P=[];
      const eye=(x,y)=>P.push({kind:'px',z:10,pts:[[x,y,'W'],[x+1,y,'O'],[x,y+1,'O'],[x+1,y+1,'O']]});
      if(facing==='down'||facing==='up'){
        // round 2 (owner: "slugs should be facing the direction they are going"): the body
        // stretches along the travel axis. Down = tail trailing at the top, shell, then the
        // head poking out at the bottom with the stalks splayed forward; up = the mirror.
        const up=facing==='up',Yf=v=>up?Y(v):h-1-Y(v);  // Yf: screen y measured from the leading edge (bottom when heading down)
        // the lava belly runs the whole length and oozes out past the shell around the head; the tail puddle trails behind
        P.push({kind:'ellipse',tag:'tail',cx,cy:Yf(20.5),rx:X(4.5-st*0.5),ry:Y(2.6),mat:'lava',z:0.5,lit:-0.1,ky:0.6,sep:false});
        P.push({kind:'ellipse',tag:'belly',cx,cy:Yf(9.5),rx:X(8.5),ry:Y(8.5+st*0.5),mat:'lava',z:1,lit:0.1,ky:0.6,kx:0.2});
        P.push({kind:'ellipse',tag:'shell',cx,cy:Yf(12.5),rx:X(9),ry:Y(6.5),mat:'body',z:2,lit:up?0.2:0.05,ky:0.8,kx:0.3});
        // crust seams across the shell's crown
        const sy0=Math.round(Yf(12.5)-2.5);
        P.push({kind:'px',z:8,pts:[[cx-6,sy0+1,'R'],[cx-5,sy0,'O'],[cx-4,sy0+1,'R'],[cx-1,sy0-1,'R'],[cx,sy0-2,'O'],[cx+1,sy0-1,'R'],[cx+4,sy0+1,'R'],[cx+5,sy0,'O'],[cx+6,sy0+1,'R']]});
        // the head leads: it sticks out past the shell on the leading edge, lit as a dome
        const hy=Yf(5-st*0.5);
        P.push({kind:'ellipse',tag:'head',cx,cy:hy,rx:X(4.5),ry:Y(3),mat:'body',z:3,lit:0.2,ky:0.4,kx:0.3});
        // eye stalks splay forward and outward from the head's corners, swaying with the crawl; the
        // eyes are body rects first so the outline wraps them, then the W/O stamp on top
        const ey=Math.round(Yf(1.8-st*0.5)),lx=Math.round(cx-X(6)-sw)-1,rx=Math.round(cx+X(6)+sw),ye=up?ey+1:ey;
        P.push({kind:'limb',tag:'stalk',x0:cx-X(3),y0:hy+(up?-1:1),x1:lx+1,y1:ye,w0:X(1),w1:X(1),mat:'body',z:4,fade:0.2,lit:0.1,sep:false});
        P.push({kind:'limb',tag:'stalk',x0:cx+X(3)-1,y0:hy+(up?-1:1),x1:rx,y1:ye,w0:X(1),w1:X(1),mat:'body',z:4,fade:0.2,lit:-0.1,sep:false});
        P.push({kind:'rect',tag:'eye',x:lx,y:ey,w:2,h:2,mat:'body',z:4.5,sep:false});
        P.push({kind:'rect',tag:'eye',x:rx,y:ey,w:2,h:2,mat:'body',z:4.5,sep:false});
        if(!up){eye(lx,ey);eye(rx,ey);}
        else{P.push({kind:'px',z:10,pts:[[lx,ey,'O'],[lx+1,ey,'O'],[rx,ey,'O'],[rx+1,ey,'O']]});} // from behind only the glow bleeds
      }else{ // left: the long profile, head forward, shell riding on the belly, the tail oozing behind
        P.push({kind:'ellipse',tag:'belly',cx:cx+X(1),cy:Y(19),rx:X(13+st),ry:Y(3.8),mat:'lava',z:1,lit:0.1,ky:0.6,kx:0.3});
        P.push({kind:'ellipse',tag:'shell',cx:cx+X(3),cy:Y(12),rx:X(10.5-st*0.5),ry:Y(6.5),mat:'body',z:2,lit:0.05,ky:0.8,kx:0.5});
        const sy0=Math.round(Y(8)),sc=Math.round(cx+X(3));
        P.push({kind:'px',z:8,pts:[[sc-6,sy0+1,'R'],[sc-5,sy0,'O'],[sc-4,sy0+1,'R'],[sc-1,sy0-1,'R'],[sc,sy0-2,'O'],[sc+1,sy0-1,'R'],[sc+4,sy0+1,'R'],[sc+5,sy0,'O'],[sc+6,sy0+1,'R']]});
        P.push({kind:'ellipse',tag:'head',cx:cx-X(9)-st,cy:Y(15),rx:X(5),ry:Y(3.8),mat:'body',z:3,lit:0,ky:0.8,kx:0.6});
        const hx=cx-X(9)-st;
        P.push({kind:'limb',tag:'stalk',x0:hx-X(2),y0:Y(13),x1:hx-X(4)-sw,y1:Y(7),w0:X(1),w1:X(1),mat:'body',z:4,fade:0.2,lit:0.1});
        P.push({kind:'limb',tag:'stalk',x0:hx+X(1),y0:Y(13),x1:hx+X(1)-sw*0.5,y1:Y(6),w0:X(1),w1:X(1),mat:'body',z:3.5,fade:0.2,lit:-0.1});
        eye(Math.round(hx-X(4)-sw)-1,Math.round(Y(5)));eye(Math.round(hx+X(1)-sw*0.5),Math.round(Y(4)));
      }
      return P;
    }
  };
}

export const RIGS={smasher:()=>brute({w:28,h:28}),smasherCast:()=>brute({w:28,h:28,cast:true}),burster:()=>tick({w:24,h:24}),bursterSwell:()=>tick({w:24,h:24,swell:true}),fireslug:()=>slug({w:32,h:24})};
export function sheet(name){return rigToSheet(RIGS[name]());}

if(process.argv[1]&&process.argv[1].replace(/\\/g,'/').endsWith('fauna-gen.mjs')){
  const name=process.argv[2]||'smasher',rig=RIGS[name]();
  for(const f of ['down','left','up']){console.log(f);console.log(render(rig,f,+(process.argv[3]||0)).join('\n'));}
}
