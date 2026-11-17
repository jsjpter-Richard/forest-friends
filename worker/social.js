import {appearance} from './economy.js';
export async function social(path,body,q,id){
 const out=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
 const codegen=n=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(n));return [...bytes].map(v=>alphabet[v%alphabet.length]).join('')};
 let profile=await q('SELECT * FROM profiles WHERE player=?',id).first();
 for(let i=0;!profile&&i<8;i++){await q('INSERT OR IGNORE INTO profiles(player,code,seen) VALUES (?,?,?)',id,codegen(6),Date.now()).run();profile=await q('SELECT * FROM profiles WHERE player=?',id).first()}
 if(!profile)return out({error:'Please try again.'},503);
 if(path==='/api/social/offline'){await q('UPDATE profiles SET seen=0 WHERE player=?',id).run();return out({ok:true})}
 await q('UPDATE profiles SET seen=? WHERE player=?',Date.now(),id).run();
 if(path==='/api/social'){
 const friends=await q("SELECT p.name,p.animal,pr.code,pr.seen FROM friend_links l JOIN players p ON p.id=CASE WHEN l.a=? THEN l.b ELSE l.a END JOIN profiles pr ON pr.player=p.id WHERE (l.a=? OR l.b=?) AND l.status='accepted' ORDER BY pr.seen DESC,p.name",id,id,id).all();
 const requests=await q("SELECT p.name,p.animal,pr.code,CASE WHEN l.requester=? THEN 'sent' ELSE 'received' END AS direction FROM friend_links l JOIN players p ON p.id=CASE WHEN l.a=? THEN l.b ELSE l.a END JOIN profiles pr ON pr.player=p.id WHERE (l.a=? OR l.b=?) AND l.status='pending'",id,id,id,id).all();
 const invitations=await q("SELECT i.id,i.room,i.expires,p.name,p.animal,r.game FROM invites i JOIN players p ON p.id=i.sender JOIN rooms r ON r.code=i.room WHERE i.recipient=? AND i.status='pending' AND i.expires>? ORDER BY i.expires DESC",id,Date.now()).all();
 for(const f of friends.results){const targetProfile=await q('SELECT player FROM profiles WHERE code=?',f.code).first();f.outfit=await appearance(q,targetProfile.player)}
 return out({code:profile.code,friends:friends.results.map(f=>({name:f.name,animal:f.animal,code:f.code,outfit:f.outfit,online:f.seen>Date.now()-35000})),requests:requests.results,invitations:invitations.results});
 }
 if(path==='/api/social/respond-invite'){
 const inv=await q("SELECT * FROM invites WHERE id=? AND recipient=? AND status='pending' AND expires>?",String(body.invite),id,Date.now()).first();
 if(!inv)return out({error:'This invitation has expired or was already answered.'},400);
 if(body.accept!==true){await q("UPDATE invites SET status='declined' WHERE id=? AND recipient=? AND status='pending'",inv.id,id).run();return out({ok:true})}
 await q('UPDATE rooms SET guest=? WHERE code=? AND (guest IS NULL OR guest=?)',id,inv.room,id).run();const room=await q('SELECT * FROM rooms WHERE code=?',inv.room).first();
 if(room?.guest!==id)return out({error:'This room is no longer available.'},400);
 await q("UPDATE invites SET status='accepted' WHERE id=? AND recipient=? AND status='pending'",inv.id,id).run();return out({code:inv.room});
 }
 const target=await q('SELECT * FROM profiles WHERE code=?',String(body.friend||'').trim().toUpperCase()).first();
 if(!target)return out({error:'Friend ID not found. Check the 6-character ID.'},400);
 if(target.player===id)return out({error:'That’s your own Friend ID.'},400);
 const [a,b]=[id,target.player].sort();let link=await q('SELECT * FROM friend_links WHERE a=? AND b=?',a,b).first();
 if(path==='/api/social/add'){
 if(link)return out({error:link.status==='accepted'?'You are already friends.':link.requester===id?'Your friend request is already waiting.':'They already sent you a request. Accept it below.'},400);
 await q("INSERT OR IGNORE INTO friend_links(a,b,requester,status) VALUES (?,?,?,'pending')",a,b,id).run();return out({ok:true});
 }
 if(path==='/api/social/respond'){
 if(!link||link.status!=='pending'||link.requester===id)return out({error:'No incoming request to answer.'},400);
 if(body.accept===true)await q("UPDATE friend_links SET status='accepted' WHERE a=? AND b=? AND requester<>? AND status='pending'",a,b,id).run();
 else await q("DELETE FROM friend_links WHERE a=? AND b=? AND requester<>? AND status='pending'",a,b,id).run();return out({ok:true});
 }
 if(path==='/api/social/invite'){
 const game=body.game||'rps';if(!['rps','gomoku','hide'].includes(game))return out({error:'Choose a supported game.'},400);
 if(link?.status!=='accepted')return out({error:'You must both accept the friendship first.'},403);
 if(target.seen<=Date.now()-35000)return out({error:'Your friend is offline. Try when they are back.'},400);
 const prior=await q("SELECT i.id,i.room FROM invites i JOIN rooms r ON r.code=i.room WHERE r.game=? AND sender=? AND recipient=? AND status='pending' AND expires>? LIMIT 1",game,id,target.player,Date.now()).first();if(prior)return out({code:prior.room});
 let roomCode;for(let i=0;i<8;i++){const c=codegen(5);const r=await q('INSERT OR IGNORE INTO rooms(code,host,game) VALUES (?,?,?)',c,id,game).run();if(r.meta?.changes||r.changes){roomCode=c;break}}
 if(!roomCode)return out({error:'Please try creating the invitation again.'},503);
 await q('INSERT INTO invites(id,sender,recipient,room,expires) VALUES (?,?,?,?,?)',crypto.randomUUID(),id,target.player,roomCode,Date.now()+120000).run();return out({code:roomCode});
 }
 return out({error:'Unknown friends action.'},404);
}
