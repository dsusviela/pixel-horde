// Horde family generator (2026-09-07): rigs for the five horde roles, built on
// mobgen.mjs. The chaser is a shambling ghoul off the world sheet's horde knot:
// hunched, head low between wide shoulders, long arms hanging forward with
// clawed hands, short legs; muted grey-purple skin, violet soul-glow eyes as the
// only high-contrast cluster (art-direction memo). Siblings reuse ghoul() with
// other proportions or add their own rig here.
//   node tools/art/horde-gen.mjs            prints the down/left/up frame 0 rows
import {rigToSheet,render} from './mobgen.mjs';

// muted grey-purple skin (ramp.mjs --hue 310 --l 0.16,0.70 --chroma 0.06; lifted a step on 2026-09-07 so the body reads on basalt), K shared with the
// hero's dark, V/W = the grave ramp's L/H so the eyes speak the violet "souls" light
export const HORDE_PAL={K:'#0d0c16',D:'#312643',M:'#5a4669',L:'#846c89',H:'#a999a7',V:'#c04aff',W:'#e8d5ff',G:'#6fe84a',O:'#ff9a2e',S:'#312643'}; // G = the spitter's bolt colour (maw glow only); O = the bomber's ember core and eyes; S = the hulk's scars (D here, lava in the volcano skin)

// Skins (2026-09-11, owner: "more volcano-y ... thematic with Slagmaw"): the same rigs
// and rows, a different palette, and a letter map applied to the rows (V eyes -> O
// ember). Slagmaw's own accents: r #7a1a0a, e #e8451a, o #ff7a1f, y #ffc63a, w #fff6d6.
export const SKINS={
  grave:  {pal:HORDE_PAL,map:{}},
  charred:{pal:{K:'#16090a',D:'#402420',M:'#68463b',L:'#8b6f5f',H:'#a99c91',V:'#ff7a1f',W:'#fff6d6',G:'#6fe84a',O:'#ff7a1f',S:'#e8451a'},map:{V:'O'}},
  cinder: {pal:{K:'#150308',D:'#42151c',M:'#6c3531',L:'#8f5d50',H:'#a68c80',V:'#ff7a1f',W:'#fff6d6',G:'#6fe84a',O:'#ff7a1f',S:'#ff7a1f'},map:{V:'O'}},
  slag:   {pal:{K:'#0b080a',D:'#382c3a',M:'#4d3f52',L:'#6a5a70',H:'#8d7f94',V:'#ff7a1f',W:'#fff6d6',G:'#6fe84a',O:'#ff7a1f',S:'#e8451a'},map:{V:'O'}},
};
export function skinSheet(name,skin){
  const S=rigToSheet(RIGS[name]()),m=SKINS[skin].map;
  const out={};for(const d of Object.keys(S))out[d]=S[d].map(rows=>rows.map(r=>r.replace(/./g,ch=>m[ch]||ch)));
  return out;
}

// o: {w,h, frames, hunch}: every coordinate is a fraction of w/h so the rig scales with the footprint
export function ghoul(o={}){
  const w=o.w||20,h=o.h||20,sx=w/20,sy=h/20;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  const bobOf=f=>[0,-1,0,-1][f%4];                       // passing frames stand 1 px taller (rule 47)
  const swing=f=>[1,0,-1,0][f%4];                       // contact frames: which leg leads
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'},claw:'D',dark:'D'},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f);
      const P=[];
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        // legs: stubs under the belly; the leading leg reaches the bottom row, the other stops 1 px short
        const legTop=Y(15)+bob;
        P.push({kind:'limb',tag:'leg',x0:cx-X(2),y0:legTop,x1:cx-X(2),y1:h-1-(s<0?1:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
        P.push({kind:'limb',tag:'leg',x0:cx+X(2),y0:legTop,x1:cx+X(2),y1:h-1-(s>0?1:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:-0.1});
        // torso: hunched, shoulders wide, sitting on the legs without a box line between them
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx,cy:Y(12)+bob,rx:X(6.3),ry:Y(4.5),mat:'body',z:2,lit:up?0.2:0,ky:up?0.5:0.8});
        // arms hang forward from the shoulders and swing opposite to the legs
        const armZ=up?1.5:3;
        P.push({kind:'limb',tag:'arm',x0:cx-X(5.5),y0:Y(10)+bob,x1:cx-X(6.5),y1:Y(17)-s,w0:X(2),w1:X(2),mat:'body',z:armZ,fade:0.5,lit:0.2});
        P.push({kind:'limb',tag:'arm',x0:cx+X(5.5),y0:Y(10)+bob,x1:cx+X(6.5),y1:Y(17)+s,w0:X(2),w1:X(2),mat:'body',z:armZ,fade:0.5,lit:-0.05});
        if(!up){ // claws: two dark fingers under each hand
          for(const [hx,dy] of [[cx-X(6.5),-s],[cx+X(6.5),s]])for(const k of [-1,0])P.push({kind:'rect',tag:'claw',x:Math.round(hx+k),y:Math.round(Y(17)+dy)+1,w:1,h:1,mat:'claw',z:armZ-0.1,sep:false});
        }
        // head: low, overlapping the shoulders; from behind we see more crown (rule 60)
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(up?5.8:6.4)+bob,rx:X(4.3),ry:Y(3.6),mat:'body',z:4,lit:up?0.25:0,ky:up?0.5:0.8});
        if(!up){
          const ey=Math.round(Y(6))+bob,l=Math.round(cx-X(3)),r=Math.round(cx+X(1));
          // brow ridge: a K shelf over the eyes, then the 2x2 soul-glow eyes with a 1 px core
          P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K'],[r+2,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V'],[r,ey,'W'],[r+1,ey,'V'],[r,ey+1,'V'],[r+1,ey+1,'V']]});
        }
      }else{ // left: profile, hunched forward (to the left), the hump at the back
        const legTop=Y(15)+bob;
        P.push({kind:'limb',tag:'leg',x0:cx+X(1),y0:legTop,x1:cx+X(1)+s*X(1),y1:h-1-(s<0?1:0),w0:X(2),w1:X(2),mat:'body',z:0.5,fade:0.6,lit:-0.15});
        P.push({kind:'limb',tag:'leg',x0:cx-X(2),y0:legTop,x1:cx-X(2)-s*X(1),y1:h-1-(s>0?1:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx:cx+X(0.5),cy:Y(12)+bob,rx:X(4.8),ry:Y(4.5),mat:'body',z:2,lit:0,kx:0.6,ky:0.7});
        P.push({kind:'ellipse',tag:'torso',cx:cx+X(1.5),cy:Y(9)+bob,rx:X(3.4),ry:Y(2.6),mat:'body',z:2.1,lit:0.1,kx:0.6,ky:0.7,sep:false});
        // near arm hangs in front, forward of the body
        P.push({kind:'limb',tag:'arm',x0:cx-X(1.5),y0:Y(10.5)+bob,x1:cx-X(3.5),y1:Y(17)-s,w0:X(2),w1:X(2),mat:'body',z:3,fade:0.5,lit:0.2});
        for(const k of [-1,0])P.push({kind:'rect',tag:'claw',x:Math.round(cx-X(3.5)+k),y:Math.round(Y(17)-s)+1,w:1,h:1,mat:'claw',z:2.9,sep:false});
        // head thrust forward and low
        P.push({kind:'ellipse',tag:'head',cx:cx-X(2.5),cy:Y(6.6)+bob,rx:X(4),ry:Y(3.4),mat:'body',z:4,lit:0,kx:0.6,ky:0.8});
        const ey=Math.round(Y(6))+bob,l=Math.round(cx-X(5.5));
        P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[l+2,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V']]});
      }
      return P;
    }
  };
}

// swarm = skitter (2026-09-11): a low four-legged grave-crawler, a big head thrust
// forward under a back hump, hands splayed, a stub tail; wide-and-low against the
// ghoul's tall-and-narrow (rules 15/39). 16x12 for r=3.5: 2.3r wide, feet on the
// bottom row. At this size only the exterior outline, the brow and the head/limb
// seams get K; far legs and the tail are value-only (rule 16 by value, not line).
export function skitter(o={}){
  const w=o.w||16,h=o.h||12,sx=w/16,sy=h/12;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  const bobOf=f=>[0,-1,0,-1][f%4];
  const swing=f=>[1,0,-1,0][f%4];
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'}},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f);
      const P=[];
      if(facing==='down'){
        // a lit hump peeks over the head; hands splay out beside the head and reach the ground
        P.push({kind:'ellipse',tag:'hump',cx,cy:Y(3.2)+bob,rx:X(5),ry:Y(2.4),mat:'body',z:1,lit:0.35,ky:0.9});
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(7)+bob,rx:X(4.5),ry:Y(3.6),mat:'body',z:3,lit:-0.15,ky:0.8,sep:false});
        P.push({kind:'limb',tag:'arm',x0:cx-X(5),y0:Y(6.5)+bob,x1:cx-X(5),y1:h-1-(s<0?1:0),w0:X(2),w1:X(2),mat:'body',z:4,fade:0.5,lit:0.2});
        P.push({kind:'limb',tag:'arm',x0:cx+X(5),y0:Y(6.5)+bob,x1:cx+X(5),y1:h-1-(s>0?1:0),w0:X(2),w1:X(2),mat:'body',z:4,fade:0.5,lit:-0.05});
        const ey=Math.round(Y(7))+bob,l=Math.round(cx-X(3)),r=Math.round(cx+X(1));
        P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[r,ey,'W'],[r+1,ey,'V']]});
      }else if(facing==='up'){
        // from behind: the crown far (top), the hump nearest (bottom), hands up by the head, hind feet at the bottom
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(3)+bob,rx:X(3.5),ry:Y(2.4),mat:'body',z:1,lit:0.35,ky:0.6});
        P.push({kind:'limb',tag:'arm',x0:cx-X(5),y0:Y(4.5)+bob,x1:cx-X(6.5),y1:Y(7.5)+bob-(s<0?1:0),w0:X(2),w1:X(2),mat:'body',z:2,fade:0.5,lit:0.2});
        P.push({kind:'limb',tag:'arm',x0:cx+X(5),y0:Y(4.5)+bob,x1:cx+X(6.5),y1:Y(7.5)+bob-(s>0?1:0),w0:X(2),w1:X(2),mat:'body',z:2,fade:0.5,lit:-0.05});
        P.push({kind:'limb',tag:'leg',x0:cx-X(3.5),y0:Y(8.5)+bob,x1:cx-X(4),y1:h-1-(s>0?1:0),w0:X(2),w1:X(2),mat:'body',z:2,fade:0.6,lit:0.1});
        P.push({kind:'limb',tag:'leg',x0:cx+X(3.5),y0:Y(8.5)+bob,x1:cx+X(4),y1:h-1-(s<0?1:0),w0:X(2),w1:X(2),mat:'body',z:2,fade:0.6,lit:-0.15});
        P.push({kind:'ellipse',tag:'hump',noSep:['leg','arm'],cx,cy:Y(6.5)+bob,rx:X(5.5),ry:Y(3.5),mat:'body',z:3,lit:0,ky:0.6});
        P.push({kind:'limb',tag:'tail',x0:cx,y0:Y(9.5)+bob,x1:cx,y1:h-1,w0:X(2),w1:X(1),mat:'body',z:3.5,fade:0.8,lit:-0.3,sep:false});
      }else{ // left: profile, head low and forward, hump behind, four legs in a bound
        const bodyY=Y(6)+bob;
        // far legs: value-only shadow legs behind the body
        P.push({kind:'limb',tag:'leg',x0:cx-X(1),y0:Y(8)+bob,x1:cx-X(1)+s*X(1),y1:h-1,w0:X(1),w1:X(1),mat:'body',z:0.5,fade:0,lit:-1,sep:false});
        P.push({kind:'limb',tag:'leg',x0:cx+X(3),y0:Y(8)+bob,x1:cx+X(3)-s*X(1),y1:h-1,w0:X(1),w1:X(1),mat:'body',z:0.5,fade:0,lit:-1,sep:false});
        P.push({kind:'limb',tag:'tail',x0:cx+X(6),y0:Y(5)+bob,x1:cx+X(7),y1:Y(4)+bob,w0:X(1),w1:X(1),mat:'body',z:1,fade:0.6,lit:-0.1,sep:false});
        P.push({kind:'ellipse',tag:'hump',noSep:['leg','tail'],cx:cx+X(1.5),cy:bodyY,rx:X(5.5),ry:Y(3),mat:'body',z:2,lit:0.05,kx:0.5,ky:0.85});
        // near legs in front of the body
        P.push({kind:'limb',tag:'leg',x0:cx-X(2.5),y0:Y(8.5)+bob,x1:cx-X(3)-s*X(1),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:2.5,fade:0.5,lit:0.1});
        P.push({kind:'limb',tag:'leg',x0:cx+X(4.5),y0:Y(8.5)+bob,x1:cx+X(5)+s*X(1),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:2.5,fade:0.5,lit:-0.1});
        P.push({kind:'ellipse',tag:'head',cx:cx-X(4),cy:Y(7.5)+bob,rx:X(3.6),ry:Y(2.9),mat:'body',z:3,lit:-0.1,kx:0.6,ky:0.8});
        const ey=Math.round(Y(7.5))+bob,l=Math.round(cx-X(6.5));
        P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V']]});
      }
      return P;
    }
  };
}

// spitter = bile toad (2026-09-11 rework, hop cycle): a squat grave-toad on folded
// haunches, bulging eye bumps on top of the head with the violet soul-glow, and a
// wide slit grin lit rot-green (the colour of its bolt). Dome-with-two-bumps against
// the ghoul's block and the skitter's slab (rule 15/39). 20x20 for r=5.
// Frames are a hop, not a walk: 0 sit, 1 launch (stretch, legs kick out), 2 airborne
// (legs trailing wide, arms tucked), 3 land (squash). The game lifts the sprite
// (e.hopY) on frames 1-2 and holds frame 0 while the toad sits and spits.
export function biletoad(o={}){
  const w=o.w||20,h=o.h||20,sx=w/20,sy=h/20;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  // pose per frame: dy body lift, rx/ry body radii, leg = 0 folded .. 1 kicked out, tuck = arms pulled in
  const POSE=[{dy:0,rx:8.5,ry:6,leg:0,tuck:0},{dy:-1,rx:8,ry:6.5,leg:0.6,tuck:0},{dy:-3,rx:8,ry:5.5,leg:1,tuck:1},{dy:1,rx:9,ry:5,leg:0.2,tuck:0}];
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'}},
    parts(facing,f){
      const q=POSE[f%4],dy=q.dy;
      const P=[];
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        // hind legs: folded = a stub under the haunch; kicked out = a splayed leg reaching the bottom corner
        const hx=6.5+q.leg*1.5,hy=Y(14.5)+dy;
        for(const sgn of [-1,1]){
          const lit=sgn<0?0.1:-0.15;
          P.push({kind:'limb',tag:'leg',x0:cx+sgn*X(6),y0:hy+Y(1.5),x1:cx+sgn*X(hx),y1:h-1,w0:X(3),w1:X(2),mat:'body',z:1,fade:0.5,lit});
        }
        // the dome body
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx,cy:Y(12)+dy,rx:X(q.rx),ry:Y(q.ry),mat:'body',z:2,lit:up?0.15:0,ky:up?0.5:0.8,kx:0.3});
        // haunches bulging at the sides; they slide out with the kick
        P.push({kind:'ellipse',tag:'haunch',cx:cx-X(6.5+q.leg*0.5),cy:hy,rx:X(2.6),ry:Y(2.8),mat:'body',z:2.5,lit:0.15,kx:0.5,ky:0.6});
        P.push({kind:'ellipse',tag:'haunch',cx:cx+X(6.5+q.leg*0.5),cy:hy,rx:X(2.6),ry:Y(2.8),mat:'body',z:2.5,lit:-0.15,kx:0.5,ky:0.6});
        // front arms: planted in front of the belly; tucked up against it in the air
        if(!up){
          const ay=Y(15)+dy,ah=q.tuck?Y(17)+dy:h-1;
          P.push({kind:'limb',tag:'arm',x0:cx-X(3.5),y0:ay,x1:cx-X(4)-q.tuck*X(1),y1:ah,w0:X(2),w1:X(2),mat:'body',z:3,fade:0.4,lit:0.1});
          P.push({kind:'limb',tag:'arm',x0:cx+X(3.5),y0:ay,x1:cx+X(4)+q.tuck*X(1),y1:ah,w0:X(2),w1:X(2),mat:'body',z:3,fade:0.4,lit:-0.15});
        }
        // eye bumps on top of the head, poking above the dome
        const ecy=Y(12)+dy-Y(q.ry)+Y(0.5);
        P.push({kind:'ellipse',tag:'eye',cx:cx-X(4),cy:ecy,rx:X(2.2),ry:Y(2.2),mat:'body',z:3,lit:up?0.3:0.1,ky:0.7});
        P.push({kind:'ellipse',tag:'eye',cx:cx+X(4),cy:ecy,rx:X(2.2),ry:Y(2.2),mat:'body',z:3,lit:up?0.2:-0.1,ky:0.7});
        if(!up){
          const ey=Math.round(ecy-Y(0.5)),l=Math.round(cx-X(5)),r=Math.round(cx+X(3));
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V'],[r,ey,'W'],[r+1,ey,'V'],[r,ey+1,'V'],[r+1,ey+1,'V']]});
          // the grin: a K-lipped slit across the face with the rot-green glow inside, corners drooping
          const my=Math.round(ecy+Y(3.5)),x0=Math.round(cx-X(6));
          const lip=[],glow=[];
          for(let i=1;i<11;i++){const o=(i<=2||i>=9)?1:0;lip.push([x0+i,my+o,'K'],[x0+i,my+2+o,'K']);glow.push([x0+i,my+1+o,(i<=2||i>=9)?'D':'G']);}
          lip.push([x0,my+2,'K'],[x0+11,my+2,'K']);
          P.push({kind:'px',z:9,pts:lip});
          P.push({kind:'px',z:10,pts:glow});
        }
      }else{ // left: profile, head end forward (left), haunch at the back, the grin along the front
        const bcx=cx-X(0.5),bcy=Y(12)+dy;
        // hind leg: folded under the haunch, or kicked out behind to the bottom-right corner
        P.push({kind:'limb',tag:'leg',x0:cx+X(4),y0:Y(15)+dy,x1:cx+X(5+q.leg*2.5),y1:h-1,w0:X(3),w1:X(2),mat:'body',z:1,fade:0.5,lit:-0.15});
        P.push({kind:'ellipse',tag:'body',noSep:['leg'],cx:bcx,cy:bcy,rx:X(q.rx-0.5),ry:Y(q.ry),mat:'body',z:2,lit:0,kx:0.5,ky:0.8});
        P.push({kind:'ellipse',tag:'haunch',cx:cx+X(4.5+q.leg*0.5),cy:Y(14)+dy+q.leg*1,rx:X(3.2),ry:Y(3.2),mat:'body',z:2.5,lit:-0.1,kx:0.5,ky:0.6});
        // front arm: planted forward; tucked back against the chest in the air
        const ax1=q.tuck?cx-X(3.5):cx-X(5.5),ay1=q.tuck?Y(17)+dy:h-1;
        P.push({kind:'limb',tag:'arm',x0:cx-X(4),y0:Y(15)+dy,x1:ax1,y1:ay1,w0:X(2),w1:X(2),mat:'body',z:3,fade:0.4,lit:0.1});
        const ecy=bcy-Y(q.ry)+Y(0.5);
        P.push({kind:'ellipse',tag:'eye',cx:cx-X(4.5),cy:ecy,rx:X(2.2),ry:Y(2.2),mat:'body',z:3,lit:0.1,kx:0.5,ky:0.7});
        const ey=Math.round(ecy-Y(0.5)),l=Math.round(cx-X(5.5));
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V']]});
        const my=Math.round(ecy+Y(3.5)),x0=Math.round(cx-X(8));
        const lip=[],glow=[];
        for(let i=1;i<7;i++){const o=i<=1?1:0;lip.push([x0+i,my+o,'K'],[x0+i,my+2+o,'K']);glow.push([x0+i,my+1+o,(i<=1||i>=6)?'D':'G']);}
        lip.push([x0,my+2,'K'],[x0+7,my+1,'K']);
        P.push({kind:'px',z:9,pts:lip});
        P.push({kind:'px',z:10,pts:glow});
      }
      return P;
    }
  };
}

// tank = grave hulk (2026-09-11): a wall of shoulders with a small skull head sunk
// low in front of them, huge arms ending in fists that drag on the ground, pillar
// legs. Square-and-sturdy (rule 39) against the ghoul's block, the skitter's slab
// and the toad's dome. 36x36 for r=9 (2r wide), feet on the bottom row; the
// per-part K seams are kept because a 36 px body carries them (rule 40).
export function hulk(o={}){
  const w=o.w||36,h=o.h||36,sx=w/36,sy=h/36;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  const bobOf=f=>[0,-1,0,-1][f%4];
  const swing=f=>[1,0,-1,0][f%4];
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'},scar:'D'},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f);
      const P=[];
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        // pillar legs; the leading one reaches the bottom row
        P.push({kind:'limb',tag:'leg',x0:cx-X(6),y0:Y(25)+bob,x1:cx-X(6.5),y1:h-1-(s<0?1:0),w0:X(6),w1:X(6),mat:'body',z:1,fade:0.5,lit:0.15});
        P.push({kind:'limb',tag:'leg',x0:cx+X(6),y0:Y(25)+bob,x1:cx+X(6.5),y1:h-1-(s>0?1:0),w0:X(6),w1:X(6),mat:'body',z:1,fade:0.5,lit:-0.1});
        // belly and the shoulder wall above it
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx,cy:Y(20)+bob,rx:X(12),ry:Y(8.5),mat:'body',z:2,lit:up?0.1:-0.05,ky:up?0.5:0.7,kx:0.3});
        P.push({kind:'ellipse',tag:'shoulders',noSep:['torso'],cx,cy:Y(13)+bob,rx:X(15),ry:Y(6.5),mat:'body',z:2.5,lit:up?0.25:0.1,ky:up?0.5:0.9,kx:0.3});
        // arms hang from the shoulder ends to fists on the ground, swinging opposite the legs
        const armZ=up?1.5:3;
        for(const sgn of [-1,1]){
          const sw=sgn<0?s:-s,lit=sgn<0?0.15:-0.1;
          P.push({kind:'limb',tag:'arm',x0:cx+sgn*X(13),y0:Y(14)+bob,x1:cx+sgn*X(14.5),y1:Y(28)+sw,w0:X(5),w1:X(5),mat:'body',z:armZ,fade:0.45,lit});
          P.push({kind:'ellipse',tag:'fist',cx:cx+sgn*X(14.5),cy:Y(30.5)+sw,rx:X(3.5),ry:Y(3),mat:'body',z:armZ+0.1,lit:lit-0.05,ky:0.7,kx:0.4});
        }
        // head: small, sunk low in front of the shoulder wall; the crown from behind
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(up?9:11.5)+bob,rx:X(5),ry:Y(4.5),mat:'body',z:up?2.2:4,lit:up?0.3:0,ky:up?0.5:0.8});
        if(!up){
          const ey=Math.round(Y(11))+bob,l=Math.round(cx-X(3.5)),r=Math.round(cx+X(1.5));
          P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K'],[r+2,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V'],[r,ey,'W'],[r+1,ey,'V'],[r,ey+1,'V'],[r+1,ey+1,'V']]});
          // a clenched jaw line under the eyes
          P.push({kind:'px',z:9,pts:[[l,ey+3,'K'],[l+1,ey+3,'D'],[l+2,ey+3,'K'],[l+3,ey+3,'D'],[l+4,ey+3,'K'],[l+5,ey+3,'D']]});
          // old scars across the belly: a few short dark clusters (rule 13)
          const by=Math.round(Y(21))+bob;
          P.push({kind:'px',z:8,pts:[[cx-5,by,'S'],[cx-4,by+1,'S'],[cx-3,by+2,'S'],[cx+3,by-2,'S'],[cx+4,by-1,'S'],[cx+5,by,'S']]});
        }
      }else{ // left: profile, hunched, the shoulder hump high at the back, head thrust forward and low, near arm dragging in front
        P.push({kind:'limb',tag:'leg',x0:cx+X(3),y0:Y(25)+bob,x1:cx+X(3)+s*X(1.5),y1:h-1-(s<0?1:0),w0:X(6),w1:X(6),mat:'body',z:0.5,fade:0.5,lit:-0.15});
        P.push({kind:'limb',tag:'leg',x0:cx-X(3),y0:Y(25)+bob,x1:cx-X(3)-s*X(1.5),y1:h-1-(s>0?1:0),w0:X(6),w1:X(6),mat:'body',z:1,fade:0.5,lit:0.15});
        // far arm behind the body
        P.push({kind:'limb',tag:'arm',x0:cx+X(6),y0:Y(14)+bob,x1:cx+X(9),y1:Y(28)-s,w0:X(5),w1:X(5),mat:'body',z:1.5,fade:0.45,lit:-0.35});
        P.push({kind:'ellipse',tag:'fist',cx:cx+X(9),cy:Y(30.5)-s,rx:X(3.5),ry:Y(3),mat:'body',z:1.6,lit:-0.4,ky:0.7});
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx:cx+X(1),cy:Y(20)+bob,rx:X(10),ry:Y(8.5),mat:'body',z:2,lit:-0.05,ky:0.7,kx:0.5});
        P.push({kind:'ellipse',tag:'shoulders',noSep:['torso'],cx:cx+X(3),cy:Y(12.5)+bob,rx:X(10),ry:Y(6.5),mat:'body',z:2.5,lit:0.1,ky:0.9,kx:0.5});
        // near arm dragging forward of the body
        P.push({kind:'limb',tag:'arm',x0:cx-X(3),y0:Y(15)+bob,x1:cx-X(9),y1:Y(28)+s,w0:X(5),w1:X(5),mat:'body',z:3,fade:0.45,lit:0.15});
        P.push({kind:'ellipse',tag:'fist',cx:cx-X(9.5),cy:Y(30.5)+s,rx:X(3.5),ry:Y(3),mat:'body',z:3.1,lit:0.1,ky:0.7,kx:0.4});
        // head thrust forward, low against the chest
        P.push({kind:'ellipse',tag:'head',cx:cx-X(7),cy:Y(11.5)+bob,rx:X(5),ry:Y(4.3),mat:'body',z:4,lit:0,ky:0.8,kx:0.6});
        const ey=Math.round(Y(11))+bob,l=Math.round(cx-X(10));
        P.push({kind:'px',z:9,pts:[[l-1,ey-1,'K'],[l,ey-1,'K'],[l+1,ey-1,'K'],[l+2,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'V'],[l,ey+1,'V'],[l+1,ey+1,'V']]});
        P.push({kind:'px',z:9,pts:[[l-1,ey+3,'K'],[l,ey+3,'D'],[l+1,ey+3,'K'],[l+2,ey+3,'D'],[l+3,ey+3,'K']]});
      }
      return P;
    }
  };
}

// bomber = ember wretch (2026-09-11): a small jagged ghoul sprinting with its arms
// out, a cracked chest cavity glowing ember-orange (the "danger" light: W core,
// O ring, rule 35) and orange eyes, the only hot-eyed body in the horde. Spiked
// shoulders make it the triangular, dangerous silhouette of the family (rule 39).
// 18x18 for r=4.5 (2r wide), feet on the bottom row; frames are a 4-step run.
export function wretch(o={}){
  const w=o.w||18,h=o.h||18,sx=w/18,sy=h/18;
  const X=v=>v*sx,Y=v=>v*sy;
  const cx=w/2;
  const bobOf=f=>[0,-1,0,-1][f%4];
  const swing=f=>[1,0,-1,0][f%4];
  // fuse (o.fuse): frame k = 0..3 of the 0.6 s fuse. The wretch crouches and hugs its
  // chest while the ember core swells from 2x2 to a 3x3 with cracks racing over the body;
  // frame 3's body letters are mapped to O/Y by the module (white-hot, rule 53).
  const core=(gx,gy,k,P)=>{
    if(k===0){P.push({kind:'px',z:9,pts:[[gx-1,gy-1,'K'],[gx,gy-2,'K'],[gx+1,gy-1,'K'],[gx+2,gy-2,'K'],[gx-1,gy,'K'],[gx+2,gy,'K'],[gx-1,gy+1,'K'],[gx+2,gy+1,'K'],[gx,gy+2,'K'],[gx+1,gy+2,'K']]});
      P.push({kind:'px',z:10,pts:[[gx,gy,'O'],[gx+1,gy,'O'],[gx,gy+1,'O'],[gx+1,gy+1,'W']]});return;}
    const c=[gx,gy],ring=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)ring.push([c[0]+dx,c[1]+dy,dx||dy?'O':'W']);
    const K=[[gx-2,gy-1],[gx-2,gy],[gx-2,gy+1],[gx+2,gy-1],[gx+2,gy],[gx+2,gy+1],[gx-1,gy-2],[gx,gy-2],[gx+1,gy-2],[gx-1,gy+2],[gx,gy+2],[gx+1,gy+2]].map(p=>[p[0],p[1],'K']);
    P.push({kind:'px',z:9,pts:K});P.push({kind:'px',z:10,pts:ring});
    if(k>=2)P.push({kind:'px',z:10,pts:[[gx-2,gy-2,'O'],[gx-3,gy-3,'O'],[gx+2,gy-2,'O'],[gx+3,gy-3,'O'],[gx-2,gy+2,'O'],[gx+2,gy+2,'O'],[gx-3,gy,'Y'],[gx+3,gy,'Y'],[gx,gy-3,'Y']]});
  };
  return {
    w,h,frames:4,K:'K',ramp:'DMLH',rim:true,
    mats:{body:{D:'D',M:'M',L:'L',H:'H'},spike:'D'},
    parts(facing,f){
      const bob=bobOf(f),s=swing(f);
      const P=[];
      if(o.fuse){
        const k=f%4;
        if(facing==='down'||facing==='up'){
          const up=facing==='up';
          P.push({kind:'limb',tag:'leg',x0:cx-X(2.5),y0:Y(14),x1:cx-X(3.5),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
          P.push({kind:'limb',tag:'leg',x0:cx+X(2.5),y0:Y(14),x1:cx+X(3.5),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:-0.1});
          P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx,cy:Y(11.5),rx:X(5.5),ry:Y(3.8),mat:'body',z:2,lit:up?0.2:-0.05,ky:up?0.5:0.8});
          P.push({kind:'px',z:2.5,pts:[[Math.round(cx-X(5.5))-1,Math.round(Y(9)),'D'],[Math.round(cx-X(5.5))-2,Math.round(Y(8)),'D'],[Math.round(cx+X(5.5)),Math.round(Y(9)),'D'],[Math.round(cx+X(5.5))+1,Math.round(Y(8)),'D']]});
          const armZ=up?1.5:3;
          P.push({kind:'limb',tag:'arm',x0:cx-X(5),y0:Y(10),x1:cx-X(2),y1:Y(14),w0:X(2),w1:X(2),mat:'body',z:armZ,fade:0.3,lit:0.2});
          P.push({kind:'limb',tag:'arm',x0:cx+X(5),y0:Y(10),x1:cx+X(2),y1:Y(14),w0:X(2),w1:X(2),mat:'body',z:armZ,fade:0.3,lit:-0.05});
          P.push({kind:'ellipse',tag:'head',cx,cy:Y(7),rx:X(3.4),ry:Y(2.9),mat:'body',z:4,lit:up?0.25:0,ky:up?0.5:0.8});
          if(!up){
            const ey=Math.round(Y(7)),l=Math.round(cx-X(2.5)),r=Math.round(cx+X(0.5));
            P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K']]});
            P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[r,ey,'W'],[r+1,ey,'O']]});
            core(Math.round(cx)-1,Math.round(Y(11.5)),k,P);
          }
        }else{
          P.push({kind:'limb',tag:'leg',x0:cx+X(1.5),y0:Y(14),x1:cx+X(2.5),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:0.5,fade:0.6,lit:-0.15});
          P.push({kind:'limb',tag:'leg',x0:cx-X(1.5),y0:Y(14),x1:cx-X(2.5),y1:h-1,w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
          P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx:cx+X(0.5),cy:Y(11.5),rx:X(4.8),ry:Y(3.6),mat:'body',z:2,lit:-0.05,kx:0.5,ky:0.8});
          P.push({kind:'px',z:2.5,pts:[[Math.round(cx+X(4.5)),Math.round(Y(8)),'D'],[Math.round(cx+X(5.5)),Math.round(Y(7)),'D'],[Math.round(cx+X(2)),Math.round(Y(7.5)),'D']]});
          P.push({kind:'limb',tag:'arm',x0:cx-X(2.5),y0:Y(10),x1:cx-X(3),y1:Y(14),w0:X(2),w1:X(2),mat:'body',z:3,fade:0.3,lit:0.2});
          P.push({kind:'ellipse',tag:'head',cx:cx-X(2.5),cy:Y(7),rx:X(3.2),ry:Y(2.8),mat:'body',z:4,lit:0,kx:0.6,ky:0.8});
          const ey=Math.round(Y(7)),l=Math.round(cx-X(5));
          P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O']]});
          core(Math.round(cx-X(0.5)),Math.round(Y(11.5)),k,P);
        }
        return P;
      }
      if(facing==='down'||facing==='up'){
        const up=facing==='up';
        // running legs: a long stride, the leading foot on the bottom row, the trailing one lifted
        P.push({kind:'limb',tag:'leg',x0:cx-X(2),y0:Y(13)+bob,x1:cx-X(3),y1:h-1-(s<0?2:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
        P.push({kind:'limb',tag:'leg',x0:cx+X(2),y0:Y(13)+bob,x1:cx+X(3),y1:h-1-(s>0?2:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:-0.1});
        // hunched torso leaning into the sprint
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx,cy:Y(10.5)+bob,rx:X(5),ry:Y(4),mat:'body',z:2,lit:up?0.2:-0.05,ky:up?0.5:0.8});
        // spiked shoulders: two D thorns poking out of the silhouette
        P.push({kind:'px',z:2.5,pts:[[Math.round(cx-X(5))-1,Math.round(Y(8))+bob,'D'],[Math.round(cx-X(5))-2,Math.round(Y(7))+bob,'D'],[Math.round(cx+X(5)),Math.round(Y(8))+bob,'D'],[Math.round(cx+X(5))+1,Math.round(Y(7))+bob,'D']]});
        // arms flung forward and out, claws open
        const armZ=up?1.5:3;
        P.push({kind:'limb',tag:'arm',x0:cx-X(4.5),y0:Y(9)+bob,x1:cx-X(7),y1:Y(14)+bob-s,w0:X(2),w1:X(1),mat:'body',z:armZ,fade:0.4,lit:0.2});
        P.push({kind:'limb',tag:'arm',x0:cx+X(4.5),y0:Y(9)+bob,x1:cx+X(7),y1:Y(14)+bob+s,w0:X(2),w1:X(1),mat:'body',z:armZ,fade:0.4,lit:-0.05});
        // head: small skull, low
        P.push({kind:'ellipse',tag:'head',cx,cy:Y(5.5)+bob,rx:X(3.4),ry:Y(2.9),mat:'body',z:4,lit:up?0.25:0,ky:up?0.5:0.8});
        if(!up){
          const ey=Math.round(Y(5.5))+bob,l=Math.round(cx-X(2.5)),r=Math.round(cx+X(0.5));
          P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K'],[r,ey-1,'K'],[r+1,ey-1,'K']]});
          P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O'],[r,ey,'W'],[r+1,ey,'O']]});
          // the ember core in the cracked chest: 1 px hot core, an orange ring, dark cracks above
          const gx=Math.round(cx)-1,gy=Math.round(Y(10))+bob;
          P.push({kind:'px',z:9,pts:[[gx-1,gy-1,'K'],[gx,gy-2,'K'],[gx+1,gy-1,'K'],[gx+2,gy-2,'K'],[gx-1,gy,'K'],[gx+2,gy,'K'],[gx-1,gy+1,'K'],[gx+2,gy+1,'K'],[gx,gy+2,'K'],[gx+1,gy+2,'K']]});
          P.push({kind:'px',z:10,pts:[[gx,gy,'O'],[gx+1,gy,'O'],[gx,gy+1,'O'],[gx+1,gy+1,'W']]});
        }
      }else{ // left: profile, leaning hard forward, arms reaching ahead, back spikes
        P.push({kind:'limb',tag:'leg',x0:cx+X(1),y0:Y(13)+bob,x1:cx+X(1)+s*X(2),y1:h-1-(s<0?2:0),w0:X(2),w1:X(2),mat:'body',z:0.5,fade:0.6,lit:-0.15});
        P.push({kind:'limb',tag:'leg',x0:cx-X(1),y0:Y(13)+bob,x1:cx-X(1)-s*X(2),y1:h-1-(s>0?2:0),w0:X(2),w1:X(2),mat:'body',z:1,fade:0.6,lit:0.15});
        P.push({kind:'ellipse',tag:'torso',noSep:['leg'],cx:cx+X(0.5),cy:Y(10.5)+bob,rx:X(4.5),ry:Y(3.8),mat:'body',z:2,lit:-0.05,kx:0.5,ky:0.8});
        P.push({kind:'px',z:2.5,pts:[[Math.round(cx+X(4)),Math.round(Y(7))+bob,'D'],[Math.round(cx+X(5)),Math.round(Y(6))+bob,'D'],[Math.round(cx+X(2)),Math.round(Y(6.5))+bob,'D']]});
        // both arms reach forward; the far one darker behind the near one
        P.push({kind:'limb',tag:'arm',x0:cx-X(1),y0:Y(9)+bob,x1:cx-X(6.5),y1:Y(11)+bob+s,w0:X(2),w1:X(1),mat:'body',z:1.5,fade:0.3,lit:-0.4});
        P.push({kind:'limb',tag:'arm',x0:cx-X(2),y0:Y(10)+bob,x1:cx-X(7.5),y1:Y(12.5)+bob-s,w0:X(2),w1:X(1),mat:'body',z:3,fade:0.3,lit:0.2});
        P.push({kind:'ellipse',tag:'head',cx:cx-X(3),cy:Y(5.5)+bob,rx:X(3.2),ry:Y(2.8),mat:'body',z:4,lit:0,kx:0.6,ky:0.8});
        const ey=Math.round(Y(5.5))+bob,l=Math.round(cx-X(5.5));
        P.push({kind:'px',z:9,pts:[[l,ey-1,'K'],[l+1,ey-1,'K']]});
        P.push({kind:'px',z:10,pts:[[l,ey,'W'],[l+1,ey,'O']]});
        const gx=Math.round(cx-X(1)),gy=Math.round(Y(10))+bob;
        P.push({kind:'px',z:9,pts:[[gx-1,gy,'K'],[gx,gy-1,'K'],[gx+1,gy-1,'K'],[gx+2,gy,'K'],[gx-1,gy+1,'K'],[gx+2,gy+1,'K'],[gx,gy+2,'K'],[gx+1,gy+2,'K']]});
        P.push({kind:'px',z:10,pts:[[gx,gy,'W'],[gx+1,gy,'O'],[gx,gy+1,'O'],[gx+1,gy+1,'O']]});
      }
      return P;
    }
  };
}

export const RIGS={chaser:()=>ghoul({w:20,h:20}),swarm:()=>skitter({w:16,h:12}),spitter:()=>biletoad({w:20,h:20}),tank:()=>hulk({w:36,h:36}),bomber:()=>wretch({w:18,h:18}),bombFuse:()=>wretch({w:18,h:18,fuse:true})};
export function sheet(name){return rigToSheet(RIGS[name]());}

if(process.argv[1]&&process.argv[1].replace(/\\/g,'/').endsWith('horde-gen.mjs')){
  const name=process.argv[2]||'chaser',rig=RIGS[name]();
  for(const f of ['down','left','up']){console.log(f);console.log(render(rig,f,+(process.argv[3]||0)).join('\n'));}
}
