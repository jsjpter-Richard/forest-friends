import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {WalkRules} from './worker/walk-rules.js';
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('worker/world.js','utf8')+'\nthis.terrain=ZooMath;',context);const terrain=context.terrain,blocked=(x,y)=>terrain.blocked(x,y);
function verify(from,to,label,projected=false,custom=blocked,escaping=false){
 const original=JSON.stringify([from,to]),route=WalkRules.path(from,to,custom);
 assert(route.length,label+' has a route');
 assert.equal(JSON.stringify([from,to]),original,label+' keeps caller objects');
 let previous=from;
 for(const [index,point] of route.entries()){
  assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
  const steps=Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y)));
  for(let s=0;s<=steps;s++){
   const t=s/steps,x=previous.x+(point.x-previous.x)*t,y=previous.y+(point.y-previous.y)*t;
   assert(x>=25&&x<=975&&y>=65&&y<=532,label+' remains in bounds');
   if(escaping&&index===0){assert(!custom(x,y),label+' escapes without crossing an obstacle');continue}
   assert(x>=28&&x<=972&&y>=68&&y<=529,label+' retains boundary clearance');
   for(const [dx,dy] of [[0,0],[-3,0],[3,0],[0,-3],[0,3],[-2.13,-2.13],[2.13,-2.13],[-2.13,2.13],[2.13,2.13]])
    assert(!custom(x+dx,y+dy),label+' avoids every obstacle and corner');
  }
  if(escaping&&index===0){
   assert.equal(point.escape,true,label+' flags the escape waypoint');
   assert(Math.hypot(point.x-from.x,point.y-from.y)<=18.001,label+' escape is short');
   for(const [dx,dy] of [[0,0],[-3,0],[3,0],[0,-3],[0,3],[-2.13,-2.13],[2.13,-2.13],[-2.13,2.13],[2.13,2.13]])assert(!custom(point.x+dx,point.y+dy),label+' gains full clearance');
  }
  previous=point;
 }
 const end=route.at(-1);
 if(projected)assert(Math.hypot(end.x-to.x,end.y-to.y)<=90.001,label+' projects at most 90 units');
 else assert(Math.hypot(end.x-to.x,end.y-to.y)<.001,label+' arrives at exact destination');
 return route;
}
verify({x:480,y:350},{x:650,y:350},'Open grass');
verify({x:50,y:250},{x:320,y:85},'Around the cottage');
verify({x:650,y:210},{x:930,y:150},'Around the pond');
verify({x:480,y:350},{x:690,y:188},'Onto the narrow pier');
verify({x:65,y:475},{x:210,y:475},'Around the bench');
verify({x:330,y:68},{x:395,y:68},'Around a tree');
verify({x:480,y:350},{x:805,y:171},'Pond bank projection',true);
verify({x:480,y:350},{x:180,y:140},'Cottage edge projection',true);
verify({x:480,y:350},{x:20,y:350},'World edge projection',true);
verify({x:480,y:350},{x:480,y:350},'Already arrived');
verify({x:283,y:150},{x:480,y:350},'Legal start touching cottage',false,blocked,true);
verify({x:25,y:350},{x:480,y:350},'Legal start touching world edge',false,blocked,true);
verify({x:25,y:65},{x:480,y:350},'Legal start touching world corner',false,blocked,true);
verify({x:180,y:230},{x:480,y:350},'Legal start touching cottage bottom',false,blocked,true);
verify({x:100,y:70},{x:480,y:350},'Legal start in tight cottage-top passage',false,blocked,true);

assert.deepEqual(WalkRules.path({x:180,y:140},{x:480,y:350},blocked),[],'Blocked start rejected');
assert.deepEqual(WalkRules.path({x:28,y:68},{x:0,y:0},()=>true),[],'Completely blocked terrain rejected');
assert.deepEqual(WalkRules.path({x:100,y:100},{x:300,y:100},(x,y)=>x>180&&x<220),[],'An uncrossable wall has no route');
assert.deepEqual(WalkRules.path({x:100,y:100},{x:9000,y:9000},blocked),[],'Far outside target rejected');
assert.deepEqual(WalkRules.path({x:NaN,y:100},{x:300,y:100},blocked),[],'Non-finite start rejected');
assert.deepEqual(WalkRules.path(null,{x:300,y:100},blocked),[],'Missing input rejected');
// The closest safe patch around a blocked click is enclosed. Projection must
// choose a slightly farther reachable patch instead of entering the enclosure.
const ring=(x,y)=>{const d=Math.hypot(x-400,y-300);return d<5||d>20&&d<35};verify({x:480,y:350},{x:400,y:300},'Reachable projection beyond enclosed patch',true,ring);
console.log('PASS: near-wall center-safe escape then full clearance; exact and projected destinations; house, pond, pier, bench and tree routes; one-unit segment safety with clearance; unreachable regions, invalid inputs and immutability.');
