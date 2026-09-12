// Crystal shard tile (2026-09-12, THE CRYSTAL MAZE): one 16-unit tile (32x32 texels
// at den 2) of violet prisms, six shimmer frames where only the glint moves
// (rule 51), and a fracture overlay for a damaged shard. Violet = the arcane
// light language; the gem cyan stays reserved for XP (rule: gameplay colours).
//   node tools/art/crystal-gen.mjs   prints frame 0 and the crack overlay
export const CRYSTAL_PAL={K:'#100c22',D:'#3b2470',M:'#6a3fb8',L:'#a06ee8',H:'#f0e4ff'};
const W=32,H=32;
// back to front: cx, half-width at the shoulder, tip y, shoulder y (full width from here), base y
const PRISMS=[
  {cx:5,hw:2,tip:16,sh:21,base:27,lean:0},
  {cx:9,hw:3,tip:4,sh:11,base:27,lean:0},
  {cx:26,hw:2,tip:13,sh:18,base:27,lean:0},
  {cx:19,hw:4,tip:1,sh:10,base:28,lean:0},
  {cx:14,hw:2,tip:19,sh:23,base:28,lean:0},
];
const grid=()=>Array.from({length:H},()=>Array(W).fill('.'));
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
// each prism carries its own K ring over whatever is behind it (rule 16), so a
// cluster reads as separate shards instead of one striped block
function drawPrism(g,p){
  const mask=grid().map(r=>r.map(()=>0));
  for(let y=p.tip;y<=p.base;y++){
    const t=y<p.sh?(y-p.tip)/(p.sh-p.tip):1;
    const hw=Math.max(0,Math.round(t*p.hw));
    for(let x=p.cx-hw;x<=p.cx+hw;x++){
      if(x<0||x>=W)continue;
      // lit left facet with a lighter far edge, the right facet in shadow (rule 28)
      const rel=(x-p.cx)/(hw||1);
      g[y][x]=rel<-0.5?'L':rel<0.2?'M':'D';mask[y][x]=1;
    }
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(mask[y][x])continue;
    if(N4.some(([dx,dy])=>mask[y+dy]&&mask[y+dy][x+dx]))g[y][x]='K';
  }
}
export function crystalRows(frame){
  const g=grid();
  for(const p of PRISMS)drawPrism(g,p);
  // glints: an H spark walks down the lit facet of the two tall prisms over the six frames
  const gl=[[7,8],[7,11],[7,14],[17,6],[16,9],[16,13]];
  const [gx,gy]=gl[frame%6];g[gy][gx]='H';g[gy+1][gx]='H';
  const [hx,hy]=gl[(frame+3)%6];g[hy][hx]='H';
  return g.map(r=>r.join(''));
}
export function crackRows(){ // over a damaged shard: dark fracture lines with a pale core, inside the prisms
  const g=grid();
  const pts=[[20,4],[19,7],[21,10],[20,13],[18,16],[19,19],[9,12],[10,15],[8,18],[9,21],[27,18],[26,21],[27,24]];
  for(const [x,y] of pts){g[y][x]='K';g[y][x+1]='H';}
  return g.map(r=>r.join(''));
}

if(process.argv[1]&&process.argv[1].replace(/\\/g,'/').endsWith('crystal-gen.mjs')){
  console.log(crystalRows(0).join('\n'));console.log();console.log(crackRows().join('\n'));
}
