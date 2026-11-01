import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../server/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
require('dotenv').config({path:new URL('../server/.env',import.meta.url).pathname});
const {KolRepository}=require('./dist/modules/kol/kol.repository.js');
const db=new PrismaClient(),repo=new KolRepository(db);
const base=process.env.SMOKE_API_BASE || 'http://127.0.0.1:9010/api/v1';
for (const path of ['/market/agent-launches?chain=solana','/market/agent-launches?url=https://example.com','/market/tokens?chain=ethereum','/market/pairs?chain=all','/market/kline?chain=bsc&address=bad','/market/kline?chain=bsc&address=0x'+'1'.repeat(40)+'&resolution=2m']) {
  assert.equal((await fetch(base+path)).status,400);
}
let kol;
try {
  kol=await db.kol.create({data:{handle:'smk'+Date.now().toString(36),note:'SMOKE_FIXTURE'}});
  const post={postId:'1000000000000000000',text:'Disposable fixture',authorId:'123',authorHandle:kol.handle,postedAt:new Date(),likes:1,reposts:0,replies:0};
  await repo.savePosts(kol.id,'123',[post],'cursor','Smoke fixture');
  await repo.savePosts(kol.id,'123',[post],'cursor','Smoke fixture');
  assert.equal(await db.kolPost.count({where:{kolId:kol.id}}),1);
  const r=await fetch(base+`/kols/${kol.id}/posts`);const result=await r.json();
  const accounts=await (await fetch(base+'/kols')).json();assert.equal(accounts.data.accounts.find(a=>a.id===kol.id).displayName,'Smoke fixture');
  assert.equal(r.status,200);assert.equal(result.data.posts.length,1);assert.equal(result.data.source,'xapi.to');
  await repo.syncFailed(kol.id,'Fixture upstream failure');
  const after=await (await fetch(base+`/kols/${kol.id}/posts`)).json();
  assert.equal(after.data.error,'Fixture upstream failure');assert.equal(after.data.posts.length,1);
  const change=async body=>{const r=await fetch(base+`/kols/${kol.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()};};
  const classified=await change({handle:kol.handle,category:'MEME'});assert.equal(classified.status,200);assert.equal(classified.data.category,'MEME');assert.equal(await db.kolPost.count({where:{kolId:kol.id}}),1);
  const originalHandle=kol.handle;
  const renamed=await change({handle:kol.handle+'x',category:'AIRDROP'});assert.equal(renamed.status,200);assert.equal(renamed.data.category,'AIRDROP');assert.equal(await db.kolPost.count({where:{kolId:kol.id}}),0);
  const reset=await db.kol.findUnique({where:{id:kol.id}});assert.equal(reset.displayName,null);assert.equal(reset.xUserId,null);
  await assert.rejects(repo.savePosts(kol.id,'123',[post],null,'Old name',originalHandle),e=>e.code==='KOL_CHANGED');assert.equal(await db.kolPost.count({where:{kolId:kol.id}}),0);

} finally {
  if(kol) {await db.kol.delete({where:{id:kol.id}});assert.equal(await db.kolPost.count({where:{kolId:kol.id}}),0);}
  await db.$disconnect();
}
console.log('PASS: SOL/BNB market DTOs, KOL posts persistence/dedup, source/error contract, category/edit isolation and cascade cleanup; no external paid calls');
