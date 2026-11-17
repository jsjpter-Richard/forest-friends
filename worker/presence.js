export async function updateRoomPresence(q,id,room,body){
 const state=body.state,session=String(body.session||''),seq=body.seq;
 if(!['active','busy','away','offline','left'].includes(state)||!session||session.length>80||!/^[a-zA-Z0-9-]+$/.test(session)||!Number.isSafeInteger(seq)||seq<0)return Response.json({error:'Invalid presence update.'},{status:400});
 await q('INSERT INTO room_presence(room,player,session,state,seen,seq) VALUES (?,?,?,?,?,?) ON CONFLICT(room,player,session) DO UPDATE SET state=excluded.state,seen=excluded.seen,seq=excluded.seq WHERE excluded.seq>room_presence.seq',room.code,id,session,state,Date.now(),seq).run();
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
export async function opponentPresence(q,room,id){
 const other=id===room.host?room.guest:room.host;if(!other)return {state:'waiting'};
 const rows=await q('SELECT state,seen FROM room_presence WHERE room=? AND player=? ORDER BY seen DESC',room.code,other).all();
 if(!rows.results.length)return {state:'unknown'};
 const live=rows.results.filter(r=>r.seen>Date.now()-20000);
 for(const state of ['active','busy','away'])if(live.some(r=>r.state===state))return {state};
 return {state:rows.results[0].state==='left'?'left':'offline'};
}
