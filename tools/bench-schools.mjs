// School power bench: how much damage does a card (or a whole kit) actually
// put out per second? Park a player in a fixed field of immortal dummies, run
// the real update loop, and count hp removed. Two scenarios, because the
// schools failed and passed on completely different ones in v0.1:
//   swarm  — 12 dummies in a ring at r=44, the moment-to-moment game
//   single — 1 dummy at r=70, the boss
//
//   node tools/bench-schools.mjs            per-card table
//   node tools/bench-schools.mjs kits       per-kit table at equal pick counts
//
// This is a comparison instrument, not a pass/fail test: read school cards
// against the OG six in the same column. v0.1 shipped with every school kit at
// 35-65% of the vanilla six in the swarm column while winning the single
// column outright — which is exactly what "the schools feel weak" meant.
import {boot} from './headless.mjs';

const SECONDS=30, DT=1/60;

function bench(kit,{n=12,ring=44,hp=4e6,seed=7}={}){
  const g=boot(seed);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
  for(let i=0;i<6;i++)g.step(DT);
  const G=g.G,p=G.players[0];
  p.weapons={};p.pas={};p.school=kit.school||null;
  // a negative level means "evolved at that level"
  for(const [id,lv] of Object.entries(kit.w))p.weapons[id]={lv:Math.abs(lv),t:0,ang:0,evo:lv<0};
  for(const [id,r] of Object.entries(kit.pas||{}))p.pas[id]=r;
  G.bossKills=1; // ultimates unlocked
  const spawn=g.ev('spawnEnemy');
  const dummies=[],last=new Map();
  const place=i=>{
    const a=i*Math.PI*2/n;
    const e=spawn('chaser',p.x+Math.cos(a)*ring,p.y+Math.sin(a)*ring);
    e.hp=e.maxhp=hp;e.sp=0;e.dmg=0;e.xp=1;dummies[i]=e;last.set(e,hp);return e;
  };
  for(let i=0;i<n;i++)place(i);
  let dealt=0;
  for(let f=0;f<SECONDS/DT;f++){
    // the field is a fixture: no drift, no deaths, no level-up pause, no
    // incoming damage — only the kit's output varies between runs
    p.hp=p.maxhp;p.invuln=1;G.xp=0;
    for(let i=0;i<n;i++){
      const e=dummies[i],a=i*Math.PI*2/n;
      e.x=p.x+Math.cos(a)*ring;e.y=p.y+Math.sin(a)*ring;e.stunT=0;e.slow=1;
    }
    G.enemies=G.enemies.filter(e=>dummies.indexOf(e)>=0);
    G.ebullets.length=0;
    g.step(DT);
    for(let i=0;i<n;i++){
      const e=dummies[i];
      if(e.dead||e.hp<=0){dealt+=last.get(e);place(i);continue;}
      dealt+=last.get(e)-e.hp;last.set(e,e.hp);
    }
  }
  return dealt/SECONDS;
}

const pad=(v,n)=>String(v).padStart(n);

if(process.argv[2]==='kits'){
  // pick budget = level-up cards spent: level N costs N picks, evo costs 1 more
  const cost=k=>Object.values(k.w).reduce((s,l)=>s+Math.abs(l)+(l<0?1:0),0)
    +Object.values(k.pas||{}).reduce((s,r)=>s+r,0);
  const KITS={
    'vanilla  early':{w:{blaster:3,spread:2,tesla:3}},
    'vanilla    mid':{w:{blaster:4,flame:4,tesla:4,orbit:4}},
    'vanilla   late':{w:{blaster:5,flame:6,tesla:5,orbit:5,rocket:5}},
    'destro   early':{school:'destro',w:{blaster:3,meteor:3},pas:{ba:2}},
    'destro     mid':{school:'destro',w:{blaster:3,meteor:4,cflame:4},pas:{ba:2,hh:3}},
    'destro    late':{school:'destro',w:{blaster:3,meteor:6,cflame:6,lavaray:5},pas:{ba:3,hh:3}},
    'illusion early':{school:'illusion',w:{blaster:3,arcmissile:3},pas:{mirror:2}},
    'illusion   mid':{school:'illusion',w:{blaster:3,eblast:4,shocking:4},pas:{mirror:3,ka:2}},
    'illusion  late':{school:'illusion',w:{blaster:3,eblast:6,shocking:6,arcmissile:5},pas:{mirror:4,ka:2}},
    'necro    early':{school:'necro',w:{blaster:3,decay:3},pas:{leech:2}},
    'necro      mid':{school:'necro',w:{blaster:3,decay:5,shadowb:4},pas:{leech:2}},
    'necro     late':{school:'necro',w:{blaster:3,decay:6,plague:5,diseases:5},pas:{leech:3}},
  };
  console.log('kit             picks    swarm   single');
  for(const [name,kit] of Object.entries(KITS))
    console.log(name.padEnd(15),pad(cost(kit),5),pad(bench(kit).toFixed(0),8),
      pad(bench(kit,{n:1,ring:70}).toFixed(0),8));
}else{
  const rows=[
    ['blaster',null],['spread',null],['orbit',null],['tesla',null],['flame',null],['rocket',null],
    ['lavaray','destro'],['meteor','destro'],['cflame','destro'],['evocation','destro'],
    ['arcmissile','illusion'],['eblast','illusion'],['shocking','illusion'],['mirage','illusion'],['assassin','illusion'],
    ['shadowb','necro'],['decay','necro'],['plague','necro'],['inflict','necro'],['diseases','necro'],['souls','necro'],
  ];
  console.log('card                    lv3 swarm  lv6 swarm  lv6 single');
  for(const [id,sc] of rows){
    const cap=sc&&['evocation','assassin','souls'].indexOf(id)>=0?4:6;
    console.log(id.padEnd(12),(sc||'vanilla').padEnd(10),
      pad(bench({school:sc,w:{[id]:Math.min(3,cap)}}).toFixed(0),8),
      pad(bench({school:sc,w:{[id]:cap}}).toFixed(0),10),
      pad(bench({school:sc,w:{[id]:cap}},{n:1,ring:70}).toFixed(0),10));
  }
}
