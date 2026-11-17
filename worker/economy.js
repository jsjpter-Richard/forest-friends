import {OUTFIT_ITEMS,FISH_TYPES} from './catalog.js';
export const EARNED_POINTS="(SELECT COUNT(*) FROM matches WHERE winner=?)+(SELECT COUNT(*) FROM rounds WHERE winner=?)+(SELECT COUNT(*) FROM gomoku_games WHERE winner=?)+(SELECT COUNT(*) FROM hide_matches WHERE winner=?)";
export async function appearance(q,id){const row=await q('SELECT hat,clothes,accessory FROM outfits WHERE owner=?',id).first();return row||{hat:null,clothes:null,accessory:null}}
export async function fishBag(q,id){const rows=await q("SELECT species,COUNT(*) AS total FROM fishing_casts WHERE owner=? AND result='caught' GROUP BY species",id).all();const used=await q('SELECT species,COUNT(*) AS total FROM fish_gifts WHERE owner=? GROUP BY species',id).all();return FISH_TYPES.map(f=>({...f,count:(rows.results.find(r=>r.species===f.id)?.total||0)-(used.results.find(r=>r.species===f.id)?.total||0)}))}
export async function account(q,id){const earned=await q('SELECT '+EARNED_POINTS+' AS total',id,id,id,id).first(),owned=await q('SELECT item,paid FROM purchases WHERE owner=?',id).all();const spent=owned.results.reduce((n,r)=>n+r.paid,0);return {score:earned.total-spent,earnedPoints:earned.total,spentPoints:spent,owned:owned.results.map(r=>r.item),outfit:await appearance(q,id),fish:await fishBag(q,id)}}
export async function economy(path,body,q,id){
 const out=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
 if(path==='/api/shop')return out({...await account(q,id),catalog:OUTFIT_ITEMS});
 if(path==='/api/shop/buy'){
 const item=OUTFIT_ITEMS.find(i=>i.id===body.item);if(!item)return out({error:'That item is not in the shop.'},400);
 await q('INSERT OR IGNORE INTO purchases(owner,item,paid) SELECT ?,?,? WHERE ('+EARNED_POINTS+')-COALESCE((SELECT SUM(paid) FROM purchases WHERE owner=?),0)>=?',id,item.id,item.price,id,id,id,id,id,item.price).run();
 const owned=await q('SELECT 1 FROM purchases WHERE owner=? AND item=?',id,item.id).first();if(!owned)return out({error:'Not enough points yet. Win another friendly match to earn more.'},400);
 return out(await account(q,id));
 }
 if(path==='/api/shop/equip'){
 if(!['hat','clothes','accessory'].includes(body.slot))return out({error:'Choose a wardrobe slot.'},400);
 const item=body.item===null?null:OUTFIT_ITEMS.find(i=>i.id===body.item&&i.slot===body.slot);if(body.item!==null&&!item)return out({error:'This item does not fit that slot.'},400);
 if(item&&!await q('SELECT 1 FROM purchases WHERE owner=? AND item=?',id,item.id).first())return out({error:'Exchange points for this item first.'},403);
 await q('INSERT INTO outfits(owner,'+body.slot+') VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET '+body.slot+'=excluded.'+body.slot,id,item?.id||null).run();return out(await account(q,id));
 }
 if(path==='/api/fishing/cancel'){await q("UPDATE fishing_casts SET result='missed' WHERE id=? AND owner=? AND result='pending'",String(body.cast),id).run();return out({ok:true})}
 if(path==='/api/fishing/start'){
 let cast=await q("SELECT * FROM fishing_casts WHERE owner=? AND result='pending' AND start_at>? ORDER BY start_at DESC LIMIT 1",id,Date.now()-12000).first();
 if(!cast){const bytes=crypto.getRandomValues(new Uint8Array(3));cast={id:crypto.randomUUID(),owner:id,start_at:Date.now()+800,phase:bytes[0]*7,zone:.36+bytes[1]/255*.34,species:FISH_TYPES[bytes[2]%FISH_TYPES.length].id};await q('INSERT INTO fishing_casts(id,owner,start_at,phase,zone,species) VALUES (?,?,?,?,?,?)',cast.id,id,cast.start_at,cast.phase,cast.zone,cast.species).run()}
 return out({id:cast.id,startAt:cast.start_at,phase:cast.phase,zone:cast.zone,zoneWidth:.28,period:3600,expiresAt:cast.start_at+12000,serverNow:Date.now()});
 }
 if(path==='/api/fishing/stop'){
 const cast=await q('SELECT * FROM fishing_casts WHERE id=? AND owner=?',String(body.cast),id).first();if(!cast)return out({error:'This cast is not yours.'},403);
 if(cast.result!=='pending')return out({error:'This cast has already been reeled in.'},409);
 const received=Date.now(),tap=Number(body.tapAt);if(!Number.isFinite(tap)||tap<received-1200||tap>received+150)return out({error:'The timing signal was lost. Please cast again.'},400);
 const elapsed=tap-cast.start_at,position=(1-Math.cos((Math.max(0,elapsed)+cast.phase)*Math.PI*2/3600))/2,hit=elapsed>=0&&elapsed<=12000&&position>=cast.zone&&position<=cast.zone+.28,result=hit?'caught':'missed';
 const changed=await q("UPDATE fishing_casts SET result=? WHERE id=? AND owner=? AND result='pending'",result,cast.id,id).run();if(!changed.meta?.changes&&!changed.changes)return out({error:'This cast has already been reeled in.'},409);
 return out({caught:hit,species:hit?FISH_TYPES.find(f=>f.id===cast.species):null,fish:await fishBag(q,id)});
 }
 if(path==='/api/fish/throw'){
 const key=Number(body.collection),species=FISH_TYPES.find(f=>f.id===body.species),request=String(body.request||'');if(!Number.isSafeInteger(key)||!species||!/^[a-f0-9-]{36}$/i.test(request))return out({error:'Choose a fish and a collected resident.'},400);
 const resident=await q('SELECT friend FROM collections WHERE rowid=? AND owner=?',key,id).first();if(!resident)return out({error:'This animal does not live in your zoo.'},403);
 const prior=await q('SELECT owner,friend,species FROM fish_gifts WHERE id=?',request).first();if(prior){if(prior.owner!==id||prior.friend!==resident.friend||prior.species!==species.id)return out({error:'This throw has already been used.'},409);return out({fish:await fishBag(q,id)})}
 const changed=await q("INSERT OR IGNORE INTO fish_gifts(id,owner,friend,species) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM fishing_casts WHERE owner=? AND species=? AND result='caught')-(SELECT COUNT(*) FROM fish_gifts WHERE owner=? AND species=?)>0",request,id,resident.friend,species.id,id,species.id,id,species.id).run();
 if(!changed.meta?.changes&&!changed.changes)return out({error:'You have no fish of this kind left. Try the pond for another catch.'},400);
 return out({fish:await fishBag(q,id)});
 }
 return out({error:'Unknown wardrobe or pond action.'},404);
}
