import {appearance} from './economy.js';
export function gomokuLine(board,x,y,color){for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){const line=[[x,y]];for(const sign of [-1,1]){for(let i=1;i<15;i++){const xx=x+dx*i*sign,yy=y+dy*i*sign;if(xx<0||xx>14||yy<0||yy>14||board[yy*15+xx]!==color)break;line.push([xx,yy])}}if(line.length>=5)return line}return []}
export async function gomoku(path,body,q,id,room,presence={state:'unknown'}){
 const out=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}}),host=id===room.host;
 const fresh=async n=>q('INSERT OR IGNORE INTO gomoku_games(id,room,n,black_host,board) VALUES (?,?,?,?,?)',crypto.randomUUID(),room.code,n,crypto.getRandomValues(new Uint8Array(1))[0]%2,JSON.stringify(Array(225).fill(0))).run();
 if(room.guest)await fresh(1);
 let g=await q('SELECT * FROM gomoku_games WHERE room=? ORDER BY n DESC LIMIT 1',room.code).first();
 if(path==='/api/gomoku/rematch'){
 if(!g?.winner||body.gameId!==g.id)return out({error:'Finish the current game first, then refresh for a rematch.'},400);
 await fresh(g.n+1);g=await q('SELECT * FROM gomoku_games WHERE room=? ORDER BY n DESC LIMIT 1',room.code).first();
 }
 if(path==='/api/gomoku/ready'||path==='/api/gomoku/rematch'){
 if(!g||!room.guest)return out({error:'Wait for your friend to join.'},400);
 if(g.winner||(path!=='/api/gomoku/rematch'&&body.gameId!==g.id))return out({error:'The game changed. Please refresh and try again.'},400);
 await q('UPDATE gomoku_games SET '+(host?'ready_a':'ready_b')+'=1 WHERE id=? AND winner IS NULL',g.id).run();return out({ok:true});
 }
 if(path==='/api/gomoku/move'){
 if(!g||g.winner||body.gameId!==g.id)return out({error:'This game is not accepting moves.'},400);
 if(!g.ready_a||!g.ready_b)return out({error:'Both players need to be ready.'},400);
 const mine=host===!!g.black_host?1:2;
 if(g.turn!==mine)return out({error:'It’s your friend’s turn.'},400);
 if(!Number.isInteger(body.x)||!Number.isInteger(body.y)||body.x<0||body.x>14||body.y<0||body.y>14)return out({error:'Choose an intersection on the board.'},400);
 if(body.version!==g.version)return out({error:'The board changed. Please try again.'},409);
 const board=JSON.parse(g.board),index=body.y*15+body.x;if(board[index])return out({error:'There is already a stone there.'},400);
 board[index]=mine;const line=gomokuLine(board,body.x,body.y,mine),winner=line.length?id:board.every(Boolean)?'draw':null;
 const changed=await q('UPDATE gomoku_games SET board=?,turn=?,winner=?,version=version+1,winning=? WHERE id=? AND version=? AND winner IS NULL',JSON.stringify(board),3-mine,winner,line.length?JSON.stringify(line):null,g.id,g.version).run();
 if(!changed.meta?.changes&&!changed.changes)return out({error:'The board changed. Please try again.'},409);
 return out({ok:true});
 }
 if(path==='/api/collect'){
 if(g?.winner!==id)return out({error:'Only the game winner can collect this animal.'},403);
 await q('INSERT OR IGNORE INTO collections(owner,friend) VALUES (?,?)',id,host?room.guest:room.host).run();return out({ok:true});
 }
 if(path==='/api/room'){
 const friendId=host?room.guest:room.host,friend=friendId?await q('SELECT name,animal FROM players WHERE id=?',friendId).first():null;
 if(friend)friend.outfit=await appearance(q,friendId);
 const collected=friendId?await q('SELECT 1 FROM collections WHERE owner=? AND friend=?',id,friendId).first():null;
 const mine=g?(host===!!g.black_host?1:2):null;
 return out({game:'gomoku',code:room.code,friend,presence,serverNow:Date.now(),canCollect:!!g&&g.winner===id,collected:!!collected,gomoku:g?{id:g.id,n:g.n,board:JSON.parse(g.board),version:g.version,mine,turn:g.turn,ready:!!g[host?'ready_a':'ready_b'],otherReady:!!g[host?'ready_b':'ready_a'],done:g.winner!==null,result:g.winner?(g.winner==='draw'?'draw':g.winner===id?'win':'lose'):null,winning:g.winning?JSON.parse(g.winning):[]}:null});
 }
 return out({error:'Choose an action for Gomoku.'},400);
}
