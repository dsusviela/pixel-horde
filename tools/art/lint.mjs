// Sprite lint: the mechanical half of the pixel-art rules
// (.claude/skills/pixel-art/rules.md) on the rows of a const or a sketch.
//   errors  ragged rows, letters missing from pal, odd dims at den 2, magenta fallback, frame dims differ
//   warns   colour count over the size budget, pure #000/#fff, >4 orphan texels, hugging runs
//           (banding), no K outline on a small sprite, low value contrast vs both grounds,
//           frame IoU < 0.85, bbox drift > 6/3 px, frame palettes differ
//   info    size / colours / outline coverage / contrast numbers
//
//   node tools/art/lint.mjs --inject tools/art/x.mjs              every const the module defines
//   node tools/art/lint.mjs chaserSprite,tankSprite [--inject ..]  named consts (file or injected)
//   node tools/art/lint.mjs --family horde|fauna|..|all            a sheet.mjs family
//   node tools/art/lint.mjs --json sketch.json                     {rows,pal,den} | {name:{..}} | [frames]
//   --strict   warnings fail too      --quiet   errors and warnings only      --file F   workspace html
// Exit 1 on errors (or warnings with --strict). Atlas / .frames sprites are linted from
// their texels (letters per colour), so "unknown letter" never fires for them.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from '../pixboot.mjs';
import {lintRows,lintFrames,formatIssues} from './pix.mjs';
import {bootArt,pickNames,resolveTarget,sketchTargets} from './targets.mjs';

const BOOL=new Set(['help','strict','quiet']);

export function lintTarget(t){
  const out=[];
  const seen=new Set();
  for(const it of t.items){
    if(it.spr.frames&&t.items.length>1&&it===t.items[0])continue;   // the sheet's facing-down alias; its frames follow
    const key=it.rows.join('|');if(seen.has(key))continue;seen.add(key);
    out.push({label:it.label,issues:lintRows(it.rows,it.pal,{den:it.den})});
  }
  for(const grp of t.groups)out.push({label:grp[0].label+' .. '+grp[grp.length-1].label,issues:lintFrames(grp)});
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const o=parseArgs(process.argv.slice(2),BOOL);
  if(o.help||(!o._.length&&!o.family&&!o.inject&&!o.json)){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\nimport ')[0]);process.exit(2);}
  let targets=[];
  if(o.json)targets=sketchTargets(o.json);
  else{
    const {g,specs}=await bootArt(o);
    for(const n of pickNames(o,specs)){const t=resolveTarget(g,n,specs[n]);if(!t){console.error('not in file: '+n);continue;}if(t.items.length)targets.push(t);}
  }
  let errors=0,warns=0;
  for(const t of targets){
    for(const {label,issues} of lintTarget(t)){
      const shown=o.quiet?issues.filter(i=>i.level!=='info'):issues;
      errors+=issues.filter(i=>i.level==='error').length;warns+=issues.filter(i=>i.level==='warn').length;
      if(shown.length||!o.quiet)console.log(label+'\n'+formatIssues(label,shown));
    }
  }
  console.log('\n'+targets.length+' target(s): '+errors+' error(s), '+warns+' warning(s)');
  process.exit(errors||(o.strict&&warns)?1:0);
}
