// School spell system (v0.1) smoke + invariant test.
// One directed bot per school plays CLASSIC for three simulated minutes,
// always drafting into its school; invariants are checked at every draft.
// Then targeted checks for each passive/status mechanic via the vm handle.
import {boot} from './headless.mjs';

let fail=0;
const OG=['spread','orbit','tesla','flame','rocket'];
const say=(ok,msg)=>{console.log((ok?'PASS ':'FAIL ')+msg);if(!ok)fail=1;};

for(const school of ['destro','illusion','necro']){
  const g=boot(11);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
  const dt=1/60;
  let sawSchoolDraft=false,badOffer=null,gotFirstActive=false;
  try{
    for(let i=0;i<60*180;i++){
      const G=g.G;
      if(G.state==='levelup'){
        for(const pk of G.levelupPicks){
          let guard=0;
          while(!pk.done&&guard++<4){
            const kinds=pk.offers.map(o=>o.kind);
            if(kinds.every(k=>k==='school')){
              sawSchoolDraft=true;
              pk.sel=pk.offers.findIndex(o=>o.id===school);
            }else{
              // the lock: no OG weapon, no other school's spell may ever show
              for(const o of pk.offers){
                if(o.id&&OG.indexOf(o.id)>=0)badOffer=o.id;
                const wd=o.id&&g.ev('WEAPONS')[o.id];
                if(wd&&wd.school&&wd.school!==school)badOffer=o.id;
                const pd=o.kind==='pas'&&g.ev('PASSIVES')[o.id];
                if(pd&&pd.school!==school)badOffer=o.id;
              }
              pk.sel=0;
            }
            g.ev('takeOffer')(pk,false);
          }
        }
        g.ev('finishLevelup')();continue;
      }
      for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
      const me=G.players[0];
      if(me.school&&Object.keys(me.weapons).length>1)gotFirstActive=true;
      // drift toward the nearest enemy so spells have targets
      let tgt=null,bd=1e9;
      for(const e of G.enemies){if(e.dead)continue;const d=(e.x-me.x)**2+(e.y-me.y)**2;if(d<bd){bd=d;tgt=e;}}
      if(tgt){const l=Math.hypot(tgt.x-me.x,tgt.y-me.y)||1;
        if(l>26){g.pads[0].axes[0]=(tgt.x-me.x)/l;g.pads[0].axes[1]=(tgt.y-me.y)/l;}
        else{g.pads[0].axes[0]=0;g.pads[0].axes[1]=0;}}
      g.step(dt);
      if(i%17===0)g.render();
    }
  }catch(err){say(false,school+' THREW: '+err.message);continue;}
  const G=g.G,me=G.players[0];
  say(sawSchoolDraft,school+': first draft was the school choice');
  say(me.school===school,school+': lock held (school='+me.school+')');
  say(gotFirstActive,school+': school card granted a first active');
  say(!badOffer,school+': no foreign cards in any draft'+(badOffer?' (saw '+badOffer+')':''));
  const spells=Object.keys(me.weapons).filter(id=>id!=='blaster');
  say(spells.length>0&&spells.every(id=>g.ev('WEAPONS')[id].school===school),
    school+': owns only own-school spells ('+spells.join(',')+')');
  // early kill counts are staggered BY DESIGN: Destruction is the strong-start
  // school (~106% of baseline at L3), Illusion/Necromancy bloom later
  say(G.kills>25,school+': spells kill ('+G.kills+' kills, level '+G.level+', wave '+G.wave+')');
  // ultimate gate: locked before a boss kill, offered after
  const seen=n=>{const s=new Set();for(let i=0;i<n;i++)for(const o of g.ev('buildOffers')(me))s.add(o.id);return s;};
  const ult=g.ev('SCHOOLS')[school].ult;
  const before=seen(30);
  g.G.bossKills=1;
  const after=seen(30);
  say(!before.has(ult),school+': ultimate locked before first boss kill');
  say(after.has(ult),school+': ultimate offered after first boss kill');
}

// ---- boss rush: schools are in there too ----
{
  const g=boot(9);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('rush');
  let saw=false;
  for(let i=0;i<60*20;i++){
    const G=g.G;
    if(G.state==='levelup'){saw=G.levelupPicks[0].offers.every(o=>o.kind==='school');break;}
    for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
    g.step(1/60);
  }
  say(saw,'rush: the opening ARM YOURSELVES draft starts with the school choice');
}

// ---- targeted mechanic checks (fresh deterministic context) ----
{
  const g=boot(3);
  g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
  const G=g.G,me=G.players[0];
  const mk=(x,y)=>{const e=g.ev('spawnEnemy')('chaser',x,y);return e;};
  g.ev('rebuildGrid')();

  // Mirage vulnerability: a dazed foe takes +30%
  {
    const e=mk(50,0);const hp0=e.hp;
    e.stunT=1;g.ev('damageEnemy')(e,10,me);
    say(Math.abs((hp0-e.hp)-13)<0.01,'mirage: dazed foe took 13 from a 10 hit');
  }
  // Plague: the infected burst and pass it on
  {
    const a=mk(200,200),b=mk(210,200);
    g.ev('rebuildGrid')();
    a.plagued={dmg:20,r:50,owner:me};
    const hpb=b.hp;
    g.ev('damageEnemy')(a,9999,me);
    say(b.hp<hpb&&(b.dead||b.plagued),'plague: death burst hit and infected the neighbor');
  }
  // Cinder Rush: a kill zeroes the longest-waiting spell
  {
    me.pas.cr=1;me.crReady=0;
    me.weapons.meteor={lv:1,t:1.8,ang:0};
    const e=mk(400,400);g.ev('rebuildGrid')();
    g.ev('damageEnemy')(e,9999,me);
    say(me.weapons.meteor.t===0,'cinder rush: kill made the next meteor instant');
  }
  // Leeched Gift: damage heals, capped
  {
    me.pas.leech=3;me.hp=10;me.leechWin=0;me.leechAcc=0;
    const e=mk(500,500);e.hp=1e6;g.ev('rebuildGrid')();
    g.ev('damageEnemy')(e,100,me);
    say(me.hp>10&&me.hp<=18.01,'leech: healed 8% capped at 8/s (hp 10 -> '+me.hp.toFixed(1)+')');
  }
  // Death Touch: a hit thrown from inside the necromancer's ring can end a
  // non-boss outright; the kill (and CINDER RUSH) credits the hitter, the
  // timer is the hitter's own, bosses are immune
  {
    g.ev('joinPlayer')(1,0);
    const ally=G.players[1];
    const VM=g.ev('Math'),rnd=VM.random;
    const roll=(fn)=>{VM.random=()=>0;try{fn();}finally{VM.random=rnd;}};
    me.pas.dtouch=3;ally.pas.cr=1;ally.crReady=0;ally.dtReady=0;ally.weapons.meteor={lv:1,t:1.8,ang:0};
    ally.x=me.x+20;ally.y=me.y;
    const e=mk(600,600);e.hp=1e6;e.maxhp=1e6;g.ev('rebuildGrid')();
    roll(()=>g.ev('damageEnemy')(e,1,ally));
    say(e.dead&&ally.kills===1&&ally.weapons.meteor.t===0,'death touch: ally in ring executed a foe; kill + cinder rush credited to the ally');
    say(ally.dtReady>G.time&&me.dtReady===0,'death touch: the timer landed on the hitter, not the necromancer');
    const e2=mk(700,700);e2.hp=1e6;g.ev('rebuildGrid')();
    roll(()=>g.ev('damageEnemy')(e2,1,ally));
    say(!e2.dead,'death touch: no second execute inside the per-player timer');
    ally.dtReady=0;const b=mk(800,800);b.hp=1e6;b.boss=true;g.ev('rebuildGrid')();
    roll(()=>g.ev('damageEnemy')(b,1,ally));
    say(!b.dead,'death touch: bosses are immune');
    b.boss=false;b.dead=true; // a chaser wearing a boss flag has no boss ai: retire it
    ally.dtReady=0;ally.x=me.x+500;const e3=mk(900,900);e3.hp=1e6;g.ev('rebuildGrid')();
    roll(()=>g.ev('damageEnemy')(e3,1,ally));
    say(!e3.dead,'death touch: no reach outside the ring');
    ally.x=me.x+40;delete ally.pas.cr;delete me.pas.dtouch;
  }
  // Knowledge Aura: haste reaches an ally standing in the ring
  {
    g.ev('joinPlayer')(1,0);
    const ally=G.players[1];
    me.pas.ka=2;ally.x=me.x+40;ally.y=me.y;
    // read the rank off the live table: a tuning pass must not read as a bug.
    // What's asserted is that the ring REACHES the ally, not the number.
    const kaMax=g.ev('PASSIVES').ka.vals[1];
    say(Math.abs(g.ev('kaHaste')(ally)-kaMax)<0.001,
      'knowledge aura: ally in the ring casts '+Math.round(kaMax*100)+'% faster');
    ally.x=me.x+500;
    say(g.ev('kaHaste')(ally)===0,'knowledge aura: no reach outside the ring');
  }
  // Mirror Friend: the echo casts the UN-evolved spell at reduced power.
  // Evolved owner bolt: (a+b*8)=13+2.8*8=35.4. Echo: (13+2.8*6)*mirror[0].
  // Both sides are derived from the live tables so a tuning pass can't turn
  // this into a false failure — what's asserted is the RULE (the echo casts
  // the un-evolved spell at the passive's share), not two frozen numbers.
  {
    me.pas.mirror=1;
    me.weapons={arcmissile:{lv:6,t:0,ang:0,evo:true}};
    const e=mk(me.x+60,me.y);e.hp=1e9;g.ev('rebuildGrid')();
    G.xp=0;G.gems.length=0;G.bullets.length=0; // no level-up pause may swallow the echo timer
    g.ev('fireSpell')(me,'arcmissile',me.weapons.arcmissile,1/60);
    const sp=g.ev('WEAPONS').arcmissile.sp,share=g.ev('PASSIVES').mirror.vals[0];
    const wantOwner=sp.a+sp.b*8,wantEcho=(sp.a+sp.b*6)*share;
    const direct=G.bullets.map(b=>b.dmg);
    let echo=null;
    for(let i=0;i<40;i++){g.step(1/60);for(const b of G.bullets)if(b.dmg<wantOwner-0.5)echo=b.dmg;}
    say(direct.length>0&&Math.abs(direct[0]-wantOwner)<0.01,
      'mirror: evolved owner bolt at '+wantOwner.toFixed(1)+' (got '+(direct[0]||0).toFixed(1)+')');
    say(echo!==null&&Math.abs(echo-wantEcho)<0.6,
      'mirror: echo cast un-evolved at '+(share*100).toFixed(0)+'% = '+wantEcho.toFixed(2)+
      ' (dmg '+(echo===null?'none':echo.toFixed(2))+')');
  }
}
// ---- every spell fires, ticks and draws (ultimates included) ----
{
  const ALL=['blaster','lavaray','meteor','cflame','evocation','arcmissile','eblast',
    'shocking','mirage','assassin','shadowb','decay','plague','inflict','souls'];
  for(const id of ALL){
    const g=boot(5);
    g.addPad();g.G.state='title';g.ev('joinPlayer')(0,0);g.ev('startRun')('classic');
    const G=g.G,me=G.players[0];
    me.weapons={};me.weapons[id]={lv:4,t:0,ang:0};
    for(let i=0;i<5;i++)g.ev('spawnEnemy')('chaser',me.x+30+i*14,me.y+(i-2)*12);
    g.ev('rebuildGrid')();
    const hp0=G.enemies.reduce((s,e)=>s+e.hp,0);
    try{
      for(let i=0;i<60*6;i++){ // six seconds: DoTs, hazards and echoes get to land
        for(const p of G.players){p.hp=p.maxhp;p.invuln=1;}
        if(G.state==='levelup'){for(const pk of G.levelupPicks)if(!pk.done)g.ev('takeOffer')(pk,true);g.ev('finishLevelup')();continue;}
        g.step(1/60);
        if(i%7===0)g.render();
      }
      const hurt=G.enemies.reduce((s,e)=>s+e.hp,0)<hp0||G.kills>0;
      say(hurt,id+': fired, ticked and drew ('+G.kills+' kills)');
    }catch(err){say(false,id+' THREW: '+err.message);}
  }
}
console.log(fail?'\nSCHOOLS: FAIL':'\nSCHOOLS: ALL PASS');
process.exit(fail);
