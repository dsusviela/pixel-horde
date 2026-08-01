// Headless harness: runs index.html's game script in a vm context with stub
// canvas/audio/DOM so the simulation can be driven from node.
//   import {boot} from './headless.mjs'
//   const g=boot(); g.startRun('rush'); g.step(1/60);
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url))+'/..';

function stubCtx(){
  const noop=()=>{};
  const c={canvas:{width:1360,height:800}};
  const keys=['fillRect','clearRect','strokeRect','beginPath','arc','moveTo','lineTo','closePath',
    'fill','stroke','save','restore','translate','scale','rotate','drawImage','setTransform',
    'clip','rect','quadraticCurveTo','bezierCurveTo','ellipse','fillText','strokeText','putImageData',
    'createLinearGradient','createRadialGradient','setLineDash','arcTo'];
  for(const k of keys)c[k]=noop;
  c.createLinearGradient=c.createRadialGradient=()=>({addColorStop:noop});
  c.getImageData=()=>({data:new Uint8ClampedArray(4)});
  c.measureText=()=>({width:10});
  return c;
}
function stubCanvas(){
  const el={width:1360,height:800,style:{},getContext:()=>stubCtx(),
    addEventListener:()=>{},getBoundingClientRect:()=>({left:0,top:0,width:1360,height:800})};
  return el;
}

// deterministic runs: the game calls Math.random() everywhere, so the harness
// swaps in a seeded generator and reruns are reproducible
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function boot(seed){
  const html=fs.readFileSync(ROOT+'/index.html','utf8');
  const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const pads=[];
  const rng=mulberry32(seed===undefined?1:seed);
  const M=Object.create(Math);M.random=rng;
  const sandbox={console,Math:M,JSON,Date,Set,Map,Array,Object,String,Number,Boolean,
    Uint8ClampedArray,Float32Array,isNaN,parseInt,parseFloat,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    performance:{now:()=>Date.now()},
    requestAnimationFrame:()=>0,
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    navigator:{getGamepads:()=>pads},
    AudioContext:function(){return{
      currentTime:0,state:'running',destination:{},sampleRate:44100,
      createOscillator:()=>({connect:()=>{},start:()=>{},stop:()=>{},frequency:{setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},type:''}),
      createGain:()=>({connect:()=>{},gain:{setValueAtTime:()=>{},setTargetAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},cancelScheduledValues:()=>{},value:0}}),
      createBuffer:()=>({getChannelData:()=>new Float32Array(64)}),
      createBufferSource:()=>({connect:()=>{},start:()=>{},stop:()=>{},buffer:null}),
      createBiquadFilter:()=>({connect:()=>{},frequency:{setValueAtTime:()=>{}},type:'',Q:{value:0}}),
      resume:()=>Promise.resolve()};},
    location:{search:'',protocol:'file:',href:'file:///index.html'},
  };
  sandbox.addEventListener=()=>{};
  sandbox.removeEventListener=()=>{};
  sandbox.innerWidth=1360;sandbox.innerHeight=800;sandbox.devicePixelRatio=1;
  sandbox.window=sandbox;
  sandbox.globalThis=sandbox;
  sandbox.document={
    getElementById:()=>stubCanvas(),
    createElement:t=>t==='canvas'?stubCanvas():{style:{},appendChild:()=>{}},
    addEventListener:()=>{},body:{appendChild:()=>{},style:{}},documentElement:{style:{}}
  };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{filename:'index.html'});
  const ev=expr=>vm.runInContext(expr,ctx);
  return {
    ctx,ev,pads,
    get G(){return ev('G');},
    // one pad, always neutral — enough for joinPlayer/update to have a roster
    addPad(){pads.push({index:pads.length,connected:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0],mapping:'standard'});},
    press(i,btn){pads[i].buttons[btn].pressed=true;},
    release(i,btn){pads[i].buttons[btn].pressed=false;},
    call(fn,...args){return vm.runInContext(`(${fn})`,ctx)(...args);},
    step(dt){return ev('update')(dt);},
    render(){return ev('render')();}
  };
}
