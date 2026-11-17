import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now=0;
const marker={hidden:true,style:{}},status={textContent:'',classList:{add(){},remove(){}}};
const context={performance:{now:()=>now},document:{getElementById:id=>id==='walk-marker'?marker:status},setTimeout(){},clearTimeout(){},Math};
vm.createContext(context);
for(const file of ['world','walk-rules','grove-rules','grove-ui'])vm.runInContext(fs.readFileSync('worker/'+file+'.js','utf8').replace(/export const /g,'const '),context);
vm.runInContext(`this.integration={
 begin(from,to){zoo={...from,vx:0,vy:0,dx:0,dy:0,keys:new Set()};return zooWalkTo(to)},
 step(dt){const input=zooWalkInput(0,0),before={x:zoo.x,y:zoo.y};Object.assign(zoo,ZooMath.drive(zoo,input.x,input.y,dt));return {before,after:{x:zoo.x,y:zoo.y},remaining:zoo.walkPath.length}},
 manual(dx,dy){return zooWalkInput(dx,dy)},
 state(){return {...zoo,walkPath:zoo.walkPath.map(p=>({...p}))}},
 blocked(x,y){return ZooMath.blocked(x,y)},
 places:GrovePlaces
};`,context);
const harness=context.integration;
const cases=[
 [{x:480,y:350},{x:650,y:350},'Open grass'],
 [{x:50,y:250},{x:320,y:85},'Cottage detour'],
 [{x:650,y:210},{x:930,y:150},'Pond detour'],
 [{x:480,y:350},{x:690,y:188},'Pier approach'],
 [{x:65,y:475},{x:210,y:475},'Bench detour'],
 [{x:330,y:68},{x:395,y:68},'Tree and upper boundary'],
 [{x:480,y:350},{x:805,y:171},'Projected pond click'],
 [{x:480,y:350},{x:180,y:140},'Projected cottage click'],
 [{x:283,y:150},{x:480,y:350},'Cottage wall escape'],
 [{x:25,y:350},{x:480,y:350},'World edge escape'],
 [{x:25,y:65},{x:480,y:350},'World corner escape'],
 [{x:180,y:230},{x:480,y:350},'Cottage bottom escape'],
 [{x:100,y:70},{x:480,y:350},'Tight top passage escape'],
 ...harness.places.map(p=>[{x:480,y:350},{x:p.x,y:p.y},'Home to '+p.id])
];
function simulate(from,to,label){
 now=0;assert(harness.begin(from,to),label+' should find a route');
 const path=harness.state().walkPath,target={...path.at(-1)};
 let done=false,frames=0,lastCheck={...from},minimumProgress=Infinity;
 for(;frames<1000;frames++){
  now+=40;
  const result=harness.step(.04),{before,after}=result;
  assert(Number.isFinite(after.x)&&Number.isFinite(after.y),label+' remains finite');
  const distance=Math.hypot(after.x-before.x,after.y-before.y),samples=Math.max(1,Math.ceil(distance));
  assert(distance<=185*.04+.001,label+' cannot teleport');
  for(let n=0;n<=samples;n++){
   const t=n/samples;assert(!harness.blocked(before.x+(after.x-before.x)*t,before.y+(after.y-before.y)*t),label+' motion does not cross an obstacle');
  }
  if(!result.remaining){done=true;break}
  if(frames%25===24){const progress=Math.hypot(after.x-lastCheck.x,after.y-lastCheck.y);minimumProgress=Math.min(minimumProgress,progress);assert(progress>=.3,label+' would trigger the 1-second stuck detector');lastCheck={...after}}
 }
 const end=harness.state();
 assert(done,label+' reaches its destination without sticking');
 assert(Math.hypot(end.x-target.x,end.y-target.y)<3.001,label+' ends within normal waypoint tolerance');
 assert.equal(marker.hidden,true,label+' hides the destination marker');
 return {label,frames,pathLength:path.length,minimumProgress};
}
const results=cases.map(([from,to,label])=>simulate(from,to,label));
// A manual nudge must cancel automatic travel immediately and return control.
now=0;assert(harness.begin({x:480,y:350},{x:690,y:188}));const manual=harness.manual(-1,0);assert.equal(manual.x,-1);assert.equal(manual.y,0);assert.equal(harness.state().walkPath.length,0);assert.equal(marker.hidden,true);
console.log(`PASS: ${results.length} real-controller routes at 40ms/frame; safe continuous movement, wall escapes, no overshoot/sticking, completion marker and manual override.`);
console.log('Longest route:',Math.max(...results.map(r=>r.frames))*40+'ms');
