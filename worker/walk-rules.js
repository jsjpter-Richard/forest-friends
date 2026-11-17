// Client-only walking routes. Competitive Hide & Seek continues to use its own rules.
export const WalkRules={
 path(from,to,blocked){
  if(typeof blocked!=='function'||![from?.x,from?.y,to?.x,to?.y].every(Number.isFinite))return [];
  const start={x:from.x,y:from.y},requested={x:to.x,y:to.y},clearance=3,spacing=12;
  const safe=(x,y)=>x>=28&&x<=972&&y>=68&&y<=529&&
   !blocked(x,y)&&!blocked(x-clearance,y)&&!blocked(x+clearance,y)&&
   !blocked(x,y-clearance)&&!blocked(x,y+clearance)&&
   !blocked(x-2.13,y-2.13)&&!blocked(x+2.13,y-2.13)&&
   !blocked(x-2.13,y+2.13)&&!blocked(x+2.13,y+2.13);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const centreSafe=(x,y)=>x>=25&&x<=975&&y>=65&&y<=532&&!blocked(x,y);
  if(!centreSafe(start.x,start.y))return [];
  const centreVisible=(a,b)=>{const steps=Math.max(1,Math.ceil(distance(a,b)));for(let i=0;i<=steps;i++){const t=i/steps;if(!centreSafe(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false}return true};
  if(!safe(start.x,start.y)){
   // Manual walking can leave a legal character against a wall. First leave
   // that existing clearance deficit along a short collision-free segment;
   // every later segment keeps the regular three-unit clearance.
   const heading=Math.atan2(requested.y-start.y,requested.x-start.x);
   for(let radius=1;radius<=18;radius++){
    const angles=Math.max(16,Math.ceil(Math.PI*2*radius/3));
    for(let step=0;step<angles;step++){
     const angle=heading+step/angles*Math.PI*2,escape={x:start.x+Math.cos(angle)*radius,y:start.y+Math.sin(angle)*radius};
     if(!safe(escape.x,escape.y)||!centreVisible(start,escape))continue;
     const onward=WalkRules.path(escape,requested,blocked);
     if(!onward.length)return [];
     return [{...escape,escape:true},...onward.filter((point,index)=>index>0||distance(point,escape)>.001)];
    }
   }
   return [];
  }
  const visible=(a,b)=>{const steps=Math.max(1,Math.ceil(distance(a,b)));for(let i=0;i<=steps;i++){const t=i/steps;if(!safe(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false}return true};
  const xs=[],ys=[];
  for(let x=28;x<972;x+=spacing)xs.push(x);xs.push(972);
  for(let y=68;y<529;y+=spacing)ys.push(y);ys.push(529);
  const columns=xs.length,count=columns*ys.length,points=Array.from({length:count},(_,i)=>({x:xs[i%columns],y:ys[Math.floor(i/columns)]}));
  const passable=new Int8Array(count).fill(-1),edgeCache=new Map();
  const isOpen=id=>{if(passable[id]<0)passable[id]=safe(points[id].x,points[id].y)?1:0;return passable[id]===1};
  const edgeOpen=(a,b)=>{const key=Math.min(a,b)*count+Math.max(a,b);if(!edgeCache.has(key))edgeCache.set(key,visible(points[a],points[b]));return edgeCache.get(key)};
  const neighbours=id=>{const col=id%columns,row=Math.floor(id/columns),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=col+dx,y=row+dy;if(x<0||x>=columns||y<0||y>=ys.length)continue;const next=y*columns+x;if(isOpen(next)&&edgeOpen(id,next))out.push(next)}return out};
  const connectors=point=>{const col=Math.min(columns-1,Math.floor((point.x-28)/spacing)),row=Math.min(ys.length-1,Math.floor((point.y-68)/spacing)),out=[];for(let y=Math.max(0,row-2);y<=Math.min(ys.length-1,row+2);y++)for(let x=Math.max(0,col-2);x<=Math.min(columns-1,col+2);x++){const id=y*columns+x;if(isOpen(id)&&distance(point,points[id])<=spacing*2.5&&visible(point,points[id]))out.push(id)}return out};
  const smooth=route=>{const result=[];let anchor=start,index=0;while(index<route.length){let last=index;while(last+1<route.length&&visible(anchor,route[last+1]))last++;const point=route[last];if(distance(anchor,point)>.001)result.push({x:point.x,y:point.y});anchor=point;index=last+1}return result.length?result:[{x:anchor.x,y:anchor.y}]};
  const seeds=connectors(start);if(!seeds.length)return [];
  const trace=(tree,id,target)=>{const reverse=[];while(id>=0){reverse.push(points[id]);id=tree.parent[id]}return smooth([...reverse.reverse(),target])};
  const search=target=>{
   const cost=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=[];
   const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const p=(i-1)>>1;if(heap[p].score<=score)break;heap[i]=heap[p];i=p}heap[i]={id,score}};
   const pop=()=>{const top=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=tail.score)break;heap[i]=heap[child];i=child}heap[i]=tail}return top};
   const ends=new Set(connectors(target));for(const id of seeds){cost[id]=distance(start,points[id]);push(id,cost[id]+distance(points[id],target))}
   while(heap.length){const {id}=pop();if(closed[id])continue;closed[id]=1;if(ends.has(id))return {cost,parent,path:trace({parent},id,target)};for(const next of neighbours(id)){if(closed[next])continue;const candidate=cost[id]+distance(points[id],points[next]);if(candidate<cost[next]){cost[next]=candidate;parent[next]=id;push(next,candidate+distance(points[next],target))}}}
   // A failed search has visited the entire reachable component. Its tree can
   // also reject enclosed projection candidates without repeating A*.
   return {cost,parent,path:null};
  };
  const routeTo=target=>visible(start,target)?[{x:target.x,y:target.y}]:search(target).path||[];
  if(safe(requested.x,requested.y))return routeTo(requested);
  let reachable=null;
  // Sample concentric rings at three-unit intervals: a nearby blocked click
  // lands on the nearest reachable bank, path or lawn, within 90 units.
  for(let radius=3;radius<=90;radius+=3){const angles=Math.max(16,Math.ceil(Math.PI*2*radius/4));for(let step=0;step<angles;step++){
   const angle=step/angles*Math.PI*2,target={x:requested.x+Math.cos(angle)*radius,y:requested.y+Math.sin(angle)*radius};
   if(!safe(target.x,target.y))continue;if(visible(start,target))return [{x:target.x,y:target.y}];
   if(!reachable){reachable=search(target);if(reachable.path)return reachable.path}
   else{let best=-1,bestCost=Infinity;for(const id of connectors(target)){const total=reachable.cost[id]+distance(points[id],target);if(total<bestCost){bestCost=total;best=id}}if(best>=0)return trace(reachable,best,target)}
  }}
  return [];
 }
};
