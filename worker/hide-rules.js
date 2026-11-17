export const HideRules={
 countdown:3000,hideTime:15000,seekTime:60000,inspectCooldown:2000,inspectRange:76,
 spawn:{x:480,y:350},
 spots:[
  {kind:'bush',x:320,y:205},{kind:'barrel',x:310,y:282},{kind:'mushroom',x:415,y:245},
  {kind:'bush',x:470,y:165},{kind:'barrel',x:535,y:330},{kind:'mushroom',x:602,y:365},
  {kind:'bush',x:597,y:250},{kind:'barrel',x:642,y:126},{kind:'mushroom',x:887,y:90},
  {kind:'bush',x:871,y:320},{kind:'barrel',x:906,y:460},{kind:'mushroom',x:830,y:420},
  {kind:'bush',x:332,y:443},{kind:'barrel',x:405,y:493},{kind:'mushroom',x:255,y:435},
  {kind:'bush',x:594,y:470},{kind:'barrel',x:738,y:281},{kind:'mushroom',x:175,y:305}
 ],
 blocked(x,y){if(x<25||x>975||y<65||y>532)return true;if(x>75&&x<283&&y>72&&y<230)return true;if(((x-805)/116)**2+((y-171)/58)**2<1&&!(x>674&&x<741&&y>143&&y<201))return true;if(x>82&&x<189&&y>457&&y<493)return true;return [[40,115,18,14],[365,70,17,14],[650,84,18,15],[974,110,18,15]].some(([tx,ty,rx,ry])=>((x-tx)/rx)**2+((y-ty)/ry)**2<1)},
 clearPath(a,b){const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/4));for(let i=1;i<=steps;i++)if(this.blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;return true},
 travel(a,b,path=[b]){if(!Array.isArray(path)||!path.length||path.length>180)return Infinity;let prior=a,length=0;for(const point of path){if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!this.clearPath(prior,point))return Infinity;length+=Math.hypot(point.x-prior.x,point.y-prior.y);prior=point}return Math.hypot(prior.x-b.x,prior.y-b.y)>.01?Infinity:length},
 nearest(pos,kind=null,checked=[]){let best=null;for(let id=0;id<this.spots.length;id++){const spot=this.spots[id];if(kind&&spot.kind!==kind||checked.includes(id))continue;const distance=Math.hypot(spot.x-pos.x,spot.y-pos.y);if(!best||distance<best.distance)best={...spot,id,distance}}return best},
 phase(r,now){if(r.reason)return 'finished';if(r.hide_at===null)return 'waiting';const at=r.paused_at??now;return at<r.hide_at?'countdown':at<r.search_at?'hiding':'searching'}
};
