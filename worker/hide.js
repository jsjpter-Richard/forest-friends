import {HideRules} from './hide-rules.js';
import {appearance} from './economy.js';
export async function hideSeek(path,body,q,id,room,presence={state:'unknown'}){
 const out=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}}),host=id===room.host,now=Date.now(),changed=r=>!!(r.meta?.changes||r.changes);
 const fresh=async n=>{await q('INSERT OR IGNORE INTO hide_matches(id,room,n,first_hider) VALUES (?,?,?,?)',crypto.randomUUID(),room.code,n,crypto.getRandomValues(new Uint8Array(1))[0]%2?room.host:room.guest).run()};
 if(room.guest)await fresh(1);
 let game=await q('SELECT * FROM hide_matches WHERE room=? ORDER BY n DESC LIMIT 1',room.code).first(),round=null;
 const addRound=async n=>{const hider=n===1?game.first_hider:(game.first_hider===room.host?room.guest:room.host),seeker=hider===room.host?room.guest:room.host;await q('INSERT OR IGNORE INTO hide_rounds(id,match_id,n,hider,seeker) VALUES (?,?,?,?,?)',crypto.randomUUID(),game.id,n,hider,seeker).run()};
 const latest=async()=>{round=game?await q('SELECT * FROM hide_rounds WHERE match_id=? ORDER BY n DESC LIMIT 1',game.id).first():null};
 if(game){await addRound(1);await latest()}
 const settle=async()=>{
  if(!round||game.winner)return;
  if(round.hide_at!==null&&!round.reason){
   const rows=(await q('SELECT player,state,seen FROM room_presence WHERE room=?',room.code).all()).results;
   const available=player=>{const own=rows.filter(p=>p.player===player);if(!own.length)return true;return own.some(p=>p.seen>now-20000&&p.state==='active')};
   const unavailable=!available(room.host)||!available(room.guest);
   if(unavailable&&round.paused_at===null)await q('UPDATE hide_rounds SET paused_at=? WHERE id=? AND paused_at IS NULL AND reason IS NULL',now,round.id).run();
   if(!unavailable&&round.paused_at!==null){const pause=Math.max(0,now-round.paused_at);await q('UPDATE hide_rounds SET hide_at=hide_at+?,search_at=search_at+?,move_at=move_at+?,inspect_at=CASE WHEN inspect_at>0 THEN inspect_at+? ELSE 0 END,paused_at=NULL WHERE id=? AND paused_at=? AND reason IS NULL',pause,pause,pause,pause,round.id,round.paused_at).run()}
   await latest();
   if(round.paused_at===null){
    if(round.search_at<=now&&round.hidden_spot===null)await q('UPDATE hide_rounds SET hidden_spot=? WHERE id=? AND hidden_spot IS NULL AND paused_at IS NULL AND search_at<=?',crypto.getRandomValues(new Uint8Array(1))[0]%HideRules.spots.length,round.id,now).run();
    await q("UPDATE hide_rounds SET reason='timeout',score=0 WHERE id=? AND reason IS NULL AND paused_at IS NULL AND search_at+?<=?",round.id,HideRules.seekTime,now).run();await latest();
   }
  }
  const history=(await q('SELECT * FROM hide_rounds WHERE match_id=? ORDER BY n',game.id).all()).results;
  if(history.length===2&&history.every(r=>r.reason)){const a=history.find(r=>r.seeker===room.host).score,b=history.find(r=>r.seeker===room.guest).score,winner=a===b?'draw':a>b?room.host:room.guest;await q('UPDATE hide_matches SET winner=? WHERE id=? AND winner IS NULL',winner,game.id).run();game=await q('SELECT * FROM hide_matches WHERE id=?',game.id).first()}
 };
 await settle();
 if(path==='/api/hide/rematch'){
  if(!game||body.matchId!==game.id){const prior=await q('SELECT * FROM hide_matches WHERE id=? AND room=?',String(body.matchId),room.code).first();if(!prior?.winner||!game||prior.n!==game.n-1)return out({error:'This match changed. Refresh and try again.'},409)}
  else{if(!game.winner)return out({error:'Finish both turns before starting another match.'},400);await fresh(game.n+1);game=await q('SELECT * FROM hide_matches WHERE room=? ORDER BY n DESC LIMIT 1',room.code).first();await addRound(1);await latest()}
 }
 if(path==='/api/hide/ready'||path==='/api/hide/rematch'){
  if(!round||!room.guest)return out({error:'Wait for your friend to join.'},400);
  if(game.winner)return out({error:'Start a rematch to play again.'},400);
  if(path!=='/api/hide/rematch'){
   if(body.matchId!==game.id)return out({error:'This match changed. Please refresh.'},409);
   if(body.roundId!==round.id){const prior=await q('SELECT n,reason FROM hide_rounds WHERE id=? AND match_id=?',String(body.roundId),game.id).first();if(!body.next||!prior?.reason||prior.n!==round.n-1)return out({error:'This turn changed. Please refresh.'},409)}
   if(round.reason){if(!body.next||round.n!==1)return out({error:'Get ready to swap roles.'},400);await addRound(2);await latest()}
  }
  if(round.hide_at!==null)return out({ok:true});
  await q('UPDATE hide_rounds SET '+(host?'ready_a':'ready_b')+'=1 WHERE id=? AND hide_at IS NULL',round.id).run();
  await q('UPDATE hide_rounds SET hide_at=?,search_at=?,move_at=? WHERE id=? AND ready_a=1 AND ready_b=1 AND hide_at IS NULL',now+HideRules.countdown,now+HideRules.countdown+HideRules.hideTime,now+HideRules.countdown+HideRules.hideTime,round.id).run();return out({ok:true});
 }
 if(path.startsWith('/api/hide/')&&!['/api/hide/ready','/api/hide/rematch'].includes(path)){
  if(!round||game.winner||round.reason||body.matchId!==game.id||body.roundId!==round.id)return out({error:'This turn is no longer accepting actions.'},409);
  if(round.paused_at!==null)return out({error:'Your friend is away. This turn is paused.'},409);
  const phase=HideRules.phase(round,now);
  if(path==='/api/hide/hide'){
   if(id!==round.hider)return out({error:'Only the hiding player can choose a disguise.'},403);
   if(phase!=='hiding'||round.hidden_spot!==null)return out({error:'Your hiding place is already locked, or time is up.'},409);
   if(!Number.isInteger(body.spot)||!HideRules.spots[body.spot])return out({error:'Choose a hiding place in the grove.'},400);
   const start=Math.min(round.search_at,now+HideRules.countdown);const r=await q('UPDATE hide_rounds SET hidden_spot=?,search_at=?,move_at=? WHERE id=? AND hidden_spot IS NULL AND reason IS NULL AND paused_at IS NULL AND hide_at<=? AND search_at>?',body.spot,start,start,round.id,now,now).run();return changed(r)?out({ok:true}):out({error:'Your hiding time is over.'},409);
  }
  if(id!==round.seeker)return out({error:'Only the seeking player can move or inspect during the search.'},403);
  if(phase!=='searching')return out({error:'Wait until the search begins.'},409);
  if(path==='/api/hide/move'){
   const x=body.x,y=body.y,seq=body.seq;if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isSafeInteger(seq)||seq<=round.move_seq)return out({error:'That movement update is out of date.'},409);
   if(now-round.move_at<100)return out({error:'Movement updates are arriving too quickly.'},429);
   const limit=Math.min(650,Math.max(0,now-round.move_at)/1000*225+8);if(HideRules.travel({x:round.sx,y:round.sy},{x,y},body.path===undefined?[{x,y}]:body.path)>limit)return out({error:'Stay on the woodland paths.'},400);
   const r=await q('UPDATE hide_rounds SET sx=?,sy=?,move_at=?,move_seq=? WHERE id=? AND move_seq=? AND reason IS NULL AND paused_at IS NULL AND search_at=? AND search_at+?>?',x,y,now,seq,round.id,round.move_seq,round.search_at,HideRules.seekTime,now).run();return changed(r)?out({x,y,seq}):out({error:'The search changed. Please try again.'},409);
  }
  if(path==='/api/hide/inspect'){
   const spot=body.spot,target=HideRules.spots[spot];if(!Number.isInteger(spot)||!target)return out({error:'Choose a prop to check.'},400);
   const checked=JSON.parse(round.checked);if(checked.includes(spot))return out({error:'You already checked that prop.'},409);
   if(Math.hypot(target.x-round.sx,target.y-round.sy)>HideRules.inspectRange)return out({error:'Walk closer before checking this prop.'},400);
   if(round.inspect_at&&now-round.inspect_at<HideRules.inspectCooldown)return out({error:'Take a breath before checking another prop.'},429);
   const found=spot===round.hidden_spot;checked.push(spot);const score=found?Math.max(0,Math.ceil((round.search_at+HideRules.seekTime-now)/100)):0;
   const r=await q('UPDATE hide_rounds SET checked=?,inspect_at=?,check_version=check_version+1,reason=?,found_at=?,score=? WHERE id=? AND check_version=? AND search_at=? AND reason IS NULL AND paused_at IS NULL AND search_at+?>?',JSON.stringify(checked),now,found?'found':null,found?now:null,score,round.id,round.check_version,round.search_at,HideRules.seekTime,now).run();if(!changed(r))return out({error:'That check was already handled. Try again.'},409);await latest();await settle();return out({found});
  }
  return out({error:'Choose a hide-and-seek action.'},404);
 }
 if(path==='/api/collect'){
  if(game?.winner!==id)return out({error:'Only the overall match winner can collect this animal.'},403);
  await q('INSERT OR IGNORE INTO collections(owner,friend) VALUES (?,?)',id,host?room.guest:room.host).run();return out({ok:true});
 }
 if(path==='/api/room'){
  const friendId=host?room.guest:room.host,friend=friendId?await q('SELECT name,animal FROM players WHERE id=?',friendId).first():null;if(friend)friend.outfit=await appearance(q,friendId);
  const collected=friendId?await q('SELECT 1 FROM collections WHERE owner=? AND friend=?',id,friendId).first():null;
  const history=game?(await q('SELECT n,seeker,reason,score FROM hide_rounds WHERE match_id=? ORDER BY n',game.id).all()).results:[];
  return out({game:'hide',code:room.code,friend,presence,serverNow:now,canCollect:game?.winner===id,collected:!!collected,hide:game?{id:game.id,n:game.n,done:game.winner!==null,result:game.winner?(game.winner==='draw'?'draw':game.winner===id?'win':'lose'):null,mine:history.filter(r=>r.seeker===id&&r.reason).reduce((s,r)=>s+r.score,0),other:history.filter(r=>r.seeker!==id&&r.reason).reduce((s,r)=>s+r.score,0),history:history.map(r=>({n:r.n,seeking:r.seeker===id,done:!!r.reason,score:r.score,reason:r.reason})),round:round?{id:round.id,n:round.n,role:round.hider===id?'hider':'seeker',phase:HideRules.phase(round,now),ready:!!round[host?'ready_a':'ready_b'],otherReady:!!round[host?'ready_b':'ready_a'],hideAt:round.hide_at,searchAt:round.search_at,deadline:round.search_at===null?null:round.search_at+HideRules.seekTime,pausedAt:round.paused_at,mySpot:round.hider===id?round.hidden_spot:null,revealedSpot:round.reason?round.hidden_spot:null,reason:round.reason,score:round.score,checked:JSON.parse(round.checked),inspectAt:round.inspect_at,position:{x:round.sx,y:round.sy,seq:round.move_seq}}:null}:null});
 }
 return out({error:'Choose an action for Hide & Seek.'},400);
}
