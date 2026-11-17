import {account,appearance,economy} from './economy.js';
import {updateRoomPresence,opponentPresence} from './presence.js';
import {gomoku} from './gomoku.js';
import {social} from './social.js';
import {hideSeek} from './hide.js';
const json=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const fail=m=>{throw Error(m)};
export async function api(req,env){
 if(!env.DB)return json({error:'The forest is not ready. Please try again shortly.'},503);
 const q=(s,...v)=>env.DB.prepare(s).bind(...v), path=new URL(req.url).pathname;
 try{
 const body=req.method==='POST'?await req.json():{};
 if(path==='/api/register'){
 const name=String(body.name||'').trim().slice(0,16),animal=Number(body.animal);
 if(!name||!Number.isInteger(animal)||animal<0||animal>7)fail('Enter a nickname and choose an animal.');
 const id=crypto.randomUUID();await q('INSERT INTO players VALUES (?,?,?)',id,name,animal).run();return json({token:id});
 }
 const id=(req.headers.get('Authorization')||'').replace('Bearer ','');
 const me=await q('SELECT * FROM players WHERE id=?',id).first();if(!me)return json({error:'Please choose your animal first.'},401);
 if(path==='/api/character'){
 const animal=body.animal;if(req.method!=='POST'||!Number.isInteger(animal)||animal<0||animal>7)return json({error:'Choose one of the eight woodland animals.'},400);
 await q('UPDATE players SET animal=? WHERE id=?',animal,id).run();return json({animal});
 }
 if(path.startsWith('/api/social'))return await social(path,body,q,id);
 if(path.startsWith('/api/shop')||path.startsWith('/api/fishing/')||path==='/api/fish/throw')return await economy(path,body,q,id);
 if(path==='/api/me'){

 const friends=await q('SELECT c.rowid AS collection,p.name,p.animal,COALESCE(f.total,0) AS feeds FROM collections c JOIN players p ON p.id=c.friend LEFT JOIN feeding f ON f.owner=c.owner AND f.friend=c.friend WHERE c.owner=? ORDER BY c.rowid',id).all();
 const details=await account(q,id);for(const friend of friends.results){const owner=await q('SELECT friend FROM collections WHERE rowid=? AND owner=?',friend.collection,id).first();friend.outfit=await appearance(q,owner.friend)}
 return json({name:me.name,animal:me.animal,...details,friends:friends.results});
 }
 if(path==='/api/feed'){
 const key=Number(body.collection);if(!Number.isSafeInteger(key)||key<1)fail('Choose a resident from your zoo.');
 const animal=await q('SELECT friend FROM collections WHERE rowid=? AND owner=?',key,id).first();if(!animal)return json({error:'This animal does not live in your zoo.'},403);
 const now=Date.now();const changed=await q('INSERT INTO feeding(owner,friend,total,last_fed) VALUES (?,?,1,?) ON CONFLICT(owner,friend) DO UPDATE SET total=feeding.total+1,last_fed=excluded.last_fed WHERE feeding.last_fed<=?',id,animal.friend,now,now-3000).run();
 if(!changed.meta?.changes&&!changed.changes)return json({error:'Let them enjoy their snack. Try again in a moment.'},429);
 const fed=await q('SELECT total FROM feeding WHERE owner=? AND friend=?',id,animal.friend).first();return json({feeds:fed.total});
 }
 if(path==='/api/create'){
 const game=body.game||'rps';if(!['rps','gomoku','hide'].includes(game))fail('Choose Rock Paper Scissors, Gomoku, or Hide & Seek.');
 for(let i=0;i<8;i++){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=[...crypto.getRandomValues(new Uint8Array(5))].map(v=>alphabet[v%alphabet.length]).join('');const r=await q('INSERT OR IGNORE INTO rooms(code,host,game) VALUES (?,?,?)',code,id,game).run();if(r.meta?.changes||r.changes)return json({code})}fail('Please try creating a room again.');
 }
 const code=String(body.code||new URL(req.url).searchParams.get('code')||'').trim().toUpperCase();
 let room=await q('SELECT * FROM rooms WHERE code=?',code).first();if(!room)fail('Room not found. Please check the invite code.');
 if(path==='/api/join'){
 const reserved=await q("SELECT recipient FROM invites WHERE room=? AND status='pending' AND expires>?",code,Date.now()).first();if(reserved&&reserved.recipient!==id&&room.host!==id)fail('This room is reserved for an invited friend.');
 if(room.host!==id){await q('UPDATE rooms SET guest=? WHERE code=? AND (guest IS NULL OR guest=?)',id,code,id).run();room=await q('SELECT * FROM rooms WHERE code=?',code).first();if(room.guest!==id)fail('This room is full.');}return json({code});
 }
 if(id!==room.host&&id!==room.guest)fail('Please join this room first.');
 if(path==='/api/presence')return await updateRoomPresence(q,id,room,body);
 const presence=await opponentPresence(q,room,id);
 if(['/api/ready','/api/rematch','/api/gomoku/ready','/api/gomoku/rematch','/api/hide/ready','/api/hide/rematch'].includes(path)&&!['active','unknown','waiting'].includes(presence.state))return json({error:'Your friend is away from the table. Wait for them to return before starting.'},400);
 if(room.game==='hide')return await hideSeek(path,body,q,id,room,presence);
 if(room.game==='gomoku')return await gomoku(path,body,q,id,room,presence);
 if(room.guest){
 await q('INSERT OR IGNORE INTO matches(id,room,n) VALUES (?,?,1)',crypto.randomUUID(),code).run();
 }
 let match=await q('SELECT * FROM matches WHERE room=? ORDER BY n DESC LIMIT 1',code).first();
 const host=id===room.host;
 const settle=async()=>{
 if(!match)return;
 const now=Date.now();
 // Only the server decides deadlines and results. Reads also settle expired rounds.
 await q("UPDATE bouts SET winner=CASE WHEN a IS NULL AND b IS NULL THEN 'draw' WHEN a IS NULL THEN ? WHEN b IS NULL THEN ? WHEN a=b THEN 'draw' WHEN (a-b+3)%3=1 THEN ? ELSE ? END,reason=CASE WHEN a IS NULL OR b IS NULL THEN 'timeout' ELSE 'played' END WHERE match_id=? AND winner IS NULL AND deadline IS NOT NULL AND ((a IS NOT NULL AND b IS NOT NULL) OR deadline<=?)",room.guest,room.host,room.host,room.guest,match.id,now).run();
 await q('UPDATE matches SET winner=CASE WHEN (SELECT COUNT(*) FROM bouts WHERE match_id=? AND winner=?)>=2 THEN ? WHEN (SELECT COUNT(*) FROM bouts WHERE match_id=? AND winner=?)>=2 THEN ? ELSE NULL END WHERE id=? AND winner IS NULL',match.id,room.host,room.host,match.id,room.guest,room.guest,match.id).run();
 match=await q('SELECT * FROM matches WHERE id=?',match.id).first();
 };
 await settle();
 if(path==='/api/rematch'){
 if(!match?.winner)fail('Finish this match first.');
 if(body.match!==match.id)fail('A new match is already waiting.');
 await q('INSERT OR IGNORE INTO matches(id,room,n) VALUES (?,?,?)',crypto.randomUUID(),code,match.n+1).run();
 match=await q('SELECT * FROM matches WHERE room=? ORDER BY n DESC LIMIT 1',code).first();
 }
 if(path==='/api/ready'||path==='/api/rematch'){
 if(!room.guest)fail('Wait for your friend to join.');
 if(match.winner)fail('The match is over. Start a rematch to play again.');
 if(path==='/api/ready'&&body.match!==match.id)fail('The match changed. Please try again.');
 await q('INSERT OR IGNORE INTO bouts(id,match_id,n) VALUES (?,?,1)',crypto.randomUUID(),match.id).run();
 let bout=await q('SELECT * FROM bouts WHERE match_id=? ORDER BY n DESC LIMIT 1',match.id).first();
 if(body.bout&&body.bout!==bout.id)fail('The round changed. Please try again.');
 if(bout.winner!==null){
 if(!body.next)fail('This round is over. Get ready for the next round.');
 await q('INSERT OR IGNORE INTO bouts(id,match_id,n) VALUES (?,?,?)',crypto.randomUUID(),match.id,bout.n+1).run();bout=await q('SELECT * FROM bouts WHERE match_id=? ORDER BY n DESC LIMIT 1',match.id).first();
 }
 const col=host?'ready_a':'ready_b';
 await q('UPDATE bouts SET '+col+'=1 WHERE id=? AND deadline IS NULL AND winner IS NULL',bout.id).run();
 await q('UPDATE bouts SET deadline=? WHERE id=? AND ready_a=1 AND ready_b=1 AND deadline IS NULL AND winner IS NULL',Date.now()+8000,bout.id).run();return json({ok:true});
 }
 if(path==='/api/move'){
 const move=Number(body.move);if(!Number.isInteger(move)||move<0||move>2)fail('Choose rock, paper, or scissors.');
 if(!match||match.winner)fail('This match has ended.');
 const col=host?'a':'b';
 const result=await q('UPDATE bouts SET '+col+'=? WHERE id=? AND match_id=? AND '+col+' IS NULL AND winner IS NULL AND deadline>? AND ready_a=1 AND ready_b=1',move,String(body.round),match.id,Date.now()).run();
 await settle();if(!result.meta?.changes&&!result.changes)fail('Your move is locked, or time has run out.');return json({ok:true});
 }
 if(path==='/api/collect'){
 if(!match||match.winner!==id)return json({error:'Only the match winner can collect this animal. Win two rounds first.'},403);
 const friend=host?room.guest:room.host;
 await q('INSERT OR IGNORE INTO collections(owner,friend) VALUES (?,?)',id,friend).run();return json({ok:true});
 }
 if(path==='/api/room'){
 const friendId=host?room.guest:room.host;
 const friend=friendId?await q('SELECT name,animal FROM players WHERE id=?',friendId).first():null;
 if(friend)friend.outfit=await appearance(q,friendId);
 const bout=match?await q('SELECT * FROM bouts WHERE match_id=? ORDER BY n DESC LIMIT 1',match.id).first():null;
 const scores=match?await q('SELECT winner,COUNT(*) AS total FROM bouts WHERE match_id=? AND winner IS NOT NULL GROUP BY winner',match.id).all():{results:[]};
 const wins=p=>scores.results.find(s=>s.winner===p)?.total||0;
 const mine=host?'a':'b',other=host?'b':'a';
 const round=bout?{id:bout.id,n:bout.n,ready:!!bout[host?'ready_a':'ready_b'],otherReady:!!bout[host?'ready_b':'ready_a'],deadline:bout.deadline,locked:bout[mine]!==null,otherLocked:bout[other]!==null,done:bout.winner!==null,result:bout.winner===null?null:bout.winner==='draw'?'draw':bout.winner===id?'win':'lose',mine:bout[mine],other:bout.winner?bout[other]:null,reason:bout.reason}:null;
 const collected=friend&&await q('SELECT 1 FROM collections WHERE owner=? AND friend=?',id,friendId).first();
 return json({game:'rps',code,friend,presence,round,serverNow:Date.now(),match:match?{id:match.id,n:match.n,mine:wins(id),other:wins(friendId),done:!!match.winner,result:match.winner?(match.winner===id?'win':'lose'):null}:null,canCollect:!!match&&match.winner===id,collected:!!collected});
 }
 return json({error:'Page not found.'},404);
 }catch(e){return json({error:e.message||'Connection failed. Please try again.'},400)}
}
