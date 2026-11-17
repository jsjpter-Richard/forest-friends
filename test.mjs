import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import assert from 'node:assert/strict';import {api} from './worker/api.js';
const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const env={DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}}}}}}};
let now=1800000000000;const originalNow=Date.now;Date.now=()=>now;
const call=async(path,token,body,status=200)=>{const r=await api(new Request('https://test/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v};
try{
const a=(await call('register','',{name:'Fern',animal:0})).token,b=(await call('register','',{name:'Clover',animal:1})).token,c=(await call('register','',{name:'Moss',animal:2})).token;
const {code}=await call('create',a,{});await call('ready',a,{code},400);await call('join',b,{code});await call('join',c,{code},400);await call('room?code='+code,c,undefined,400);
const state=()=>call('room?code='+code,a),other=()=>call('room?code='+code,b);
let s=await state();const first=s.match.id;
await call('collect',a,{code},403);await call('collect',b,{code},403);
async function readyBoth(){let s=await state();await call('ready',a,{code,match:s.match.id,bout:s.round?.id,next:!!s.round?.done});s=await state();assert.equal(s.round.deadline,null);now+=30000;assert.equal((await state()).round.done,false,'one ready must not start clock');await call('ready',b,{code,match:s.match.id,bout:s.round.id});s=await state();assert.equal(s.round.deadline,now+8000);return s.round.id}
let rid=await readyBoth();await call('move',a,{code,round:rid,move:0});assert.equal((await other()).round.other,null,'opponent cannot see secret move');await call('move',a,{code,round:rid,move:1},400);await call('move',b,{code,round:rid,move:2});s=await state();assert.equal(s.match.mine,1);assert.equal(s.match.done,false);assert.equal((await call('me',a)).score,0);await call('collect',a,{code},403);
// A tie requires a fresh ready handshake and gives no score.
rid=await readyBoth();await call('move',a,{code,round:rid,move:1});await call('move',b,{code,round:rid,move:1});s=await state();assert.equal(s.round.result,'draw');assert.equal(s.match.mine,1);
// One missing player loses even when sending a late move.
rid=await readyBoth();await call('move',b,{code,round:rid,move:0});now+=8001;await call('move',a,{code,round:rid,move:1},400);s=await state();assert.equal(s.round.result,'lose');assert.equal(s.round.reason,'timeout');assert.equal(s.match.other,1);assert.equal(s.match.done,false);
// Neither player moves: no win awarded.
rid=await readyBoth();now+=8000;s=await state();assert.equal(s.round.result,'draw');assert.equal(s.round.reason,'timeout');assert.equal(s.match.mine,1);assert.equal(s.match.other,1);
// 2–1 match finish: only winner can collect and earns exactly one point.
rid=await readyBoth();await call('move',a,{code,round:rid,move:2});await call('move',b,{code,round:rid,move:1});s=await state();assert.equal(s.match.done,true);assert.equal(s.match.mine,2);assert.equal(s.match.result,'win');assert.equal(s.canCollect,true);assert.equal((await other()).canCollect,false);
await call('collect',b,{code},403);await call('collect',a,{code});await call('collect',a,{code});assert.equal((await call('me',a)).friends.length,1);assert.equal((await call('me',b)).animal,1);assert.equal((await call('me',a)).score,1);
await call('move',a,{code,round:rid,move:0},400);await state();assert.equal((await call('me',a)).score,1);
// Concurrent rematches create one new match; neither starts timer alone.
const responses=await Promise.all([call('rematch',a,{code,match:first}),call('rematch',b,{code,match:first})]);s=await state();assert.equal(s.match.n,2);assert.equal(db.prepare('SELECT COUNT(*) c FROM matches').get().c,2);assert.equal(s.match.mine,0);await call('collect',a,{code},403);
// In this rematch, reverse the winner: historical winner has no new collection rights.
if(!s.round.deadline){await call('ready',b,{code,match:s.match.id,bout:s.round.id})}s=await state();rid=s.round.id;await call('move',b,{code,round:rid,move:1});now+=8000;s=await state();assert.equal(s.match.other,1);rid=await readyBoth();await call('move',b,{code,round:rid,move:2});now+=8000;s=await state();assert.equal(s.match.result,'lose');assert.equal(s.canCollect,false);await call('collect',a,{code},403);await call('collect',b,{code});assert.equal((await call('me',b)).friends.length,1);assert.equal((await call('me',b)).score,1);
assert.equal(db.prepare('SELECT COUNT(*) c FROM friend_links').get().c,0,'room joins and collections do not add friends');
const sa=await call('social',a),sb=await call('social',b),sc=await call('social',c);
assert.match(sa.code,/^[A-HJ-NP-Z2-9]{6}$/);await call('social/add',a,{friend:sa.code},400);
await call('social/add',a,{friend:sb.code});assert.equal((await call('social',b)).requests[0].direction,'received');assert.equal((await call('social',b)).friends.length,0);
await call('social/respond',a,{friend:sb.code,accept:true},400);await call('social/invite',a,{friend:sb.code},403);
await call('social/respond',b,{friend:sa.code,accept:true});assert.equal((await call('social',a)).friends.length,1);assert.equal((await call('social',b)).friends.length,1);
await call('social/add',a,{friend:sb.code},400);await call('social/invite',c,{friend:sa.code},403);
const inv=await call('social/invite',a,{friend:sb.code});assert.match(inv.code,/^[A-HJ-NP-Z2-9]{5}$/);assert.equal((await call('social/invite',a,{friend:sb.code})).code,inv.code);
await call('join',c,{code:inv.code},400);let inbox=(await call('social',b)).invitations;assert.equal(inbox.length,1);
await call('social/respond-invite',c,{invite:inbox[0].id,accept:true},400);await call('social/respond-invite',b,{invite:inbox[0].id,accept:false});assert.equal((await call('social',b)).invitations.length,0);
await call('social/respond-invite',b,{invite:inbox[0].id,accept:true},400);
await call('social/invite',a,{friend:sb.code});inbox=(await call('social',b)).invitations;const accepted=await call('social/respond-invite',b,{invite:inbox[0].id,accept:true});assert.equal((await call('room?code='+accepted.code,b)).friend.name,'Fern');
await call('social/offline',b,{});assert.equal((await call('social',a)).friends[0].online,false);await call('social/invite',a,{friend:sb.code},400);
await call('social',b);await call('social/invite',a,{friend:sb.code});inbox=(await call('social',b)).invitations;now+=120001;assert.equal((await call('social',b)).invitations.length,0);await call('social/respond-invite',b,{invite:inbox[0].id,accept:true},400);
await call('social/add',c,{friend:sa.code});await call('social/respond',a,{friend:sc.code,accept:false});assert.equal((await call('social',c)).requests.length,0);
const collection=(await call('me',a)).friends[0].collection;
await call('feed',c,{collection},403);await call('feed',a,{collection:999999},403);await call('feed',a,{collection:'invalid'},400);
assert.equal((await call('feed',a,{collection})).feeds,1);await call('feed',a,{collection},429);now+=3000;
assert.equal((await call('feed',a,{collection})).feeds,2);assert.equal((await call('me',a)).friends[0].feeds,2);
assert.equal((await call('me',a)).score,1,'feeding must not change match points');
console.log('PASS: feeding collected residents only; ownership; cooldown; persistent feed count; unchanged match points.');
console.log('PASS: independent friendships; mutual acceptance; friend IDs; incoming/outgoing requests; consent checks; online presence; reserved invitations; accept/decline/expiry; 5-character room codes.');
console.log('PASS: two-player rooms; ready handshake; 8s server deadline; hidden/locked moves; ties; one/both timeouts; late moves; 2–1 match; winner-only collection; idempotent score/collection; concurrent rematches; historical winner cannot collect after losing.');
}finally{Date.now=originalNow;db.close()}
