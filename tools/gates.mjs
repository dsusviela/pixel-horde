// Cross-platform gate runner (npm scripts can't set env vars the same way on
// Windows cmd and POSIX shells).
//   node tools/gates.mjs          test + perf
//   node tools/gates.mjs test     NP=1 test-playground
//   node tools/gates.mjs perf     perf-stress (CAP 15000) + perf-calls (NP=4, CAP 4000)
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const which=process.argv[2]||'all';
const steps={
  test:[['test-playground.mjs',{NP:'1'}]],
  perf:[['perf-stress.mjs',{CAP:'15000'}],['perf-calls.mjs',{NP:'4',CAP:'4000'}]],
};
const list=which==='all'?[...steps.test,...steps.perf]:steps[which];
if(!list){console.error('usage: node gates.mjs [test|perf]');process.exit(2);}
for(const [script,env] of list){
  console.log('\n== '+Object.entries(env).map(([k,v])=>k+'='+v).join(' ')+' node '+script);
  const r=spawnSync(process.execPath,[path.join(here,script)],{stdio:'inherit',env:{...process.env,...env},cwd:here});
  if(r.status!==0){console.error('FAILED: '+script);process.exit(r.status||1);}
}
console.log('\nall gates passed');
