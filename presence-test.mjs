import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import assert from 'node:assert/strict';import {api} from './worker/api.js';
const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}}}}}}};
let time=1800000000000;const now=Date.now;Date.now=()=>time;
const call=async(path,token,body,status=200)=>{const r=await api(new Request('https://test/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v};
try{
const a=(await call('register','',{name:'Fern',animal:0})).token,b=(await call('register','',{name:'River',animal:1})).token,c=(await call('register','',{name:'Oak',animal:4})).token;
for(const game of ['rps','gomoku']){
 const {code}=await call('create',a,{game});await call('join',b,{code});const get=()=>call('room?code='+code,a);assert.equal((await get()).presence.state,'unknown');
 const update=(state,seq,session='river-tab')=>call('presence',b,{code,session,state,seq});
 await call('presence',c,{code,session:'stranger',state:'active',seq:1},400);await call('presence',b,{code,session:'river',state:'fake',seq:1},400);
 await update('active',1);assert.equal((await get()).presence.state,'active');
 await update('busy',2);assert.equal((await get()).presence.state,'busy');
 let s=await get();await call(game==='rps'?'ready':'gomoku/ready',a,{code,match:s.match?.id,gameId:s.gomoku?.id},400);
 await update('away',3);assert.equal((await get()).presence.state,'away');await update('active',2);assert.equal((await get()).presence.state,'away','stale network request must not overwrite newer away');
 await update('left',4);assert.equal((await get()).presence.state,'left');await update('active',5);assert.equal((await get()).presence.state,'active');await update('offline',6);assert.equal((await get()).presence.state,'offline');
 await update('active',1,'second-tab');assert.equal((await get()).presence.state,'active','another active window keeps the player online');await update('offline',7);assert.equal((await get()).presence.state,'active');
 time+=20001;assert.equal((await get()).presence.state,'offline','abrupt disconnect expires after 20s');await update('left',8);assert.equal((await get()).presence.state,'left');await update('active',9);assert.equal((await get()).presence.state,'active');
 s=await get();await call(game==='rps'?'ready':'gomoku/ready',a,{code,match:s.match?.id,gameId:s.gomoku?.id});
 assert.equal((await call('me',a)).score,0);assert.equal((await call('me',b)).score,0);assert.equal((await call('me',a)).friends.length,0);
 if(game==='gomoku')assert((await get()).gomoku.board.every(v=>v===0),'presence changes preserve the chessboard');
}
console.log('PASS: both game rooms; busy/away/left/offline/return; 20-second expiry; out-of-order updates; multiple windows; membership validation; no new-round start while away; no automatic wins or collections; saved board intact.');
}finally{Date.now=now;db.close()}
