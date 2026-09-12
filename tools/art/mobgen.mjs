// Mob generator for the hand-drawn horde (2026-09-07): a body is a list of parts
// (ellipses / tapered limbs) in z order, each filled from a material ramp and lit
// from the top-left (rule 27/28), outlined in K on its own border (rule 16/37),
// with the glowing eye cluster stamped last (rule 41). One rig gives four
// facings (side is mirrored for right, rule 48) and N walk frames that only
// move limbs and bob the body (rules 46/47/51). Same idiom as the Slagmaw
// generator: labelled regions first, rows out, never hand-typed rows.
//
//   import {render, rigToSheet} from './mobgen.mjs';
//   const sheet = rigToSheet(rig)            -> {down:[rows,...], up:[...], left:[...], right:[...]}
//
// A rig: {w,h, frames:N, ramp:'DMLH', rim:true, parts:(facing,frame)=>[part,...]}
// part: {kind:'ellipse', cx,cy,rx,ry, mat:'body', z, outline:true, lit:0.15}
//       {kind:'limb', x0,y0,x1,y1, w0,w1, mat, z}          tapered segment (w0 at start, w1 at end)
//       {kind:'rect', x,y,w,h, mat, z}
//       {kind:'px', pts:[[x,y,letter],...], z}              raw stamps (eyes, teeth, claws)
// every part may carry tag:'leg' and noSep:['leg'] (no K ring over those parts behind it) and sep:false (no ring at all)
// mat names index rig.mats: {body:{D:'D',M:'M',L:'L',H:'H'}} letters per shade step; a
// material with a single letter is flat (rule 30).

export const hash=(x,y)=>{let h=(x*374761393+y*668265263)^0x5bd1e995;h=(h^(h>>13))*1274126177;return ((h^(h>>16))&0xffff)/0xffff;};
const N4=[[1,0],[-1,0],[0,1],[0,-1]];

function grid(w,h){return Array.from({length:h},()=>Array(w).fill('.'));}
function shadeLetter(mat,l){
  // l in about [-1,1]: > .55 highlight, > .1 light, > -.4 mid, else dark
  if(typeof mat==='string')return mat;
  if(l>0.72&&mat.H)return mat.H;
  if(l>0.3&&mat.L)return mat.L;
  if(l>-0.45&&mat.M)return mat.M;
  return mat.D||mat.M;
}
// fill an ellipse; light from top-left, so the normal's x and y both count
function ellipse(g,mask,p,mat){
  const {cx,cy,rx,ry}=p,lit=p.lit===undefined?0:p.lit,W=g[0].length,H=g.length;
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
    if(x<0||y<0||x>=W||y>=H)continue;
    const nx=(x+0.5-cx)/rx,ny=(y+0.5-cy)/ry;
    if(nx*nx+ny*ny>1)continue;
    const l=-nx*(p.kx===undefined?0.35:p.kx)-ny*(p.ky===undefined?0.8:p.ky)+lit;
    g[y][x]=shadeLetter(mat,l);mask[y][x]=1;
  }
}
function limb(g,mask,p,mat){
  const W=g[0].length,H=g.length,dx=p.x1-p.x0,dy=p.y1-p.y0,len=Math.max(Math.abs(dx),Math.abs(dy))+1,vertical=Math.abs(dy)>=Math.abs(dx);
  for(let i=0;i<len;i++){
    const t=len===1?0:i/(len-1),x=p.x0+dx*t,y=p.y0+dy*t,wi=Math.max(1,Math.round(p.w0+(p.w1-p.w0)*t));
    const c=vertical?x:y,start=Math.floor(c-wi/2+0.5);
    for(let k=0;k<wi;k++){
      const xx=vertical?start+k:Math.round(x),yy=vertical?Math.round(y):start+k;
      if(xx<0||yy<0||xx>=W||yy>=H)continue;
      const n=wi>1?(k/(wi-1))*2-1:0;                 // -1 at the lit edge (left / top) .. 1 at the shadow edge
      const l=-n*0.6-t*(p.fade===undefined?0.5:p.fade)+(p.lit===undefined?0.25:p.lit);
      g[yy][xx]=shadeLetter(mat,l);mask[yy][xx]=1;
    }
  }
}
function rect(g,mask,p,mat){
  const W=g[0].length,H=g.length;
  for(let y=p.y;y<p.y+p.h;y++)for(let x=p.x;x<p.x+p.w;x++){
    if(x<0||y<0||x>=W||y>=H)continue;
    const nx=p.w>1?((x-p.x)/(p.w-1))*2-1:0,ny=p.h>1?((y-p.y)/(p.h-1))*2-1:0;
    g[y][x]=shadeLetter(mat,-nx*0.4-ny*0.8+(p.lit===undefined?0.1:p.lit));mask[y][x]=1;
  }
}
// draw one part onto the sprite: its own K border over whatever is behind it (rule 16),
// only where the border pixel is not already this part's own fill
function drawPart(g,body,owner,part,mats,K){
  const W=g[0].length,H=g.length,mask=grid(W,H).map(r=>r.map(()=>0));
  const mat=mats[part.mat]||part.mat||'M';
  if(part.kind==='ellipse')ellipse(g,mask,part,mat);
  else if(part.kind==='limb')limb(g,mask,part,mat);
  else if(part.kind==='rect')rect(g,mask,part,mat);
  else if(part.kind==='px'){for(const [x,y,c] of part.pts)if(x>=0&&y>=0&&x<W&&y<H){g[y][x]=c;mask[y][x]=1;}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(mask[y][x]){body[y][x]=1;owner[y][x]=part.tag||part.kind;}
  if(part.outline===false||part.kind==='px')return;
  const noSep=part.noSep||[];
  // border against parts behind: a K ring outside this part where a body pixel already sits
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(mask[y][x])continue;
    if(!N4.some(([dx,dy])=>x+dx>=0&&y+dy>=0&&x+dx<W&&y+dy<H&&mask[y+dy][x+dx]))continue;
    if(body[y][x]&&g[y][x]!=='.'&&part.sep!==false&&!noSep.includes(owner[y][x]))g[y][x]=K;
  }
}
// exterior outline (rule 37/38): K around the whole body, dropped nowhere (small sprites on busy ground)
function outline(g,body,K){
  const W=g[0].length,H=g.length;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(body[y][x])continue;
    if(N4.some(([dx,dy])=>x+dx>=0&&y+dy>=0&&x+dx<W&&y+dy<H&&body[y+dy][x+dx])){g[y][x]=K;}
  }
}
// orphan prune on the body ramps (rule 11): a single ramp texel with no same-colour 4-neighbour
// takes the most common neighbouring ramp colour
function prune(g,ramp){
  const W=g[0].length,H=g.length,at=(x,y)=>x>=0&&y>=0&&x<W&&y<H?g[y][x]:'.';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const c=g[y][x];if(!ramp.includes(c))continue;
    if(N4.some(([dx,dy])=>at(x+dx,y+dy)===c))continue;
    const cnt={};for(const [dx,dy] of N4){const n=at(x+dx,y+dy);if(ramp.includes(n))cnt[n]=(cnt[n]||0)+1;}
    const best=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];if(best)g[y][x]=best;
  }
}
// rim light (rule 33/34): body ramp texels whose upper or left neighbour is outside the body step
// one shade up, so the lit silhouette edge reads on a ground at the body's own value
function rim(g,body,ramp){
  const W=g[0].length,H=g.length,out=g.map(r=>r.slice());
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=ramp.indexOf(g[y][x]);if(i<0||i>=ramp.length-2)continue; // never up to the highlight
    const ext=(xx,yy)=>xx<0||yy<0||xx>=W||yy>=H||!body[yy][xx];
    if(ext(x,y-1)||ext(x-1,y))out[y][x]=ramp[i+1];
  }
  for(let y=0;y<H;y++)g[y]=out[y];
}
export function render(rig,facing,frame){
  const g=grid(rig.w,rig.h),body=grid(rig.w,rig.h).map(r=>r.map(()=>0)),owner=grid(rig.w,rig.h).map(r=>r.map(()=>'')),K=rig.K||'K';
  const parts=rig.parts(facing,frame).filter(Boolean).sort((a,b)=>(a.z||0)-(b.z||0));
  for(const p of parts)if(p.kind!=='px')drawPart(g,body,owner,p,rig.mats,K);
  if(rig.rim&&rig.ramp)rim(g,body,rig.ramp);
  outline(g,body,K);
  if(rig.ramp)prune(g,rig.ramp);
  for(const p of parts)if(p.kind==='px')drawPart(g,body,owner,p,rig.mats,K);   // eyes and stamps sit on top of everything
  return g.map(r=>r.join(''));
}
export const mirror=rows=>rows.map(r=>r.split('').reverse().join(''));
export function rigToSheet(rig){
  const n=rig.frames||4,out={};
  for(const f of ['down','up','left'])out[f]=Array.from({length:n},(_,i)=>render(rig,f,i));
  out.right=out.left.map(mirror);
  return out;
}
// the literal an art module emits: a walk sheet like atlasSheet() builds (frames[dir][frame],
// dir order down/up/left/right) so mobFrame() in playground.html picks facings unchanged
export function sheetLiteral(name,sheet,palExpr,den,note){
  const dirs=['down','up','left','right'];
  const F=JSON.stringify(dirs.map(d=>sheet[d]));
  return `const ${name}=(()=>{const P=${palExpr},F=${F}.map(d=>d.map(r=>makeSprite(r,P,${den})));const c=F[0][0];c.frames=F;return c;})();${note?' // '+note:''}`;
}
