import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../server/package.json',import.meta.url));
require('dotenv').config({path:fileURLToPath(new URL('../server/.env',import.meta.url))});
const {PrismaClient}=require('@prisma/client');
const {AgentStore}=require('./dist/modules/agent-runs/agent.store.js');
const {AgentLeaseRepository}=require('./dist/modules/agent-runs/lease.repository.js');
const {ActivityRepository}=require('./dist/modules/wallet-activity/activity.repository.js');
const db=new PrismaClient(),store=new AgentStore(db,new AgentLeaseRepository(db)),activity=new ActivityRepository(db);
const tag='smoke:'+randomUUID(),scopes=[tag+':A',tag+':B'],hash='0x'+randomBytes(32).toString('hex'),address='0x'+randomBytes(20).toString('hex');
let candidate,run,brief;
try {
 candidate=await db.mintCandidate.create({data:{chainId:'56',contractAddress:address,source:'SMOKE_FIXTURE'}});
 run=await db.agentRun.create({data:{kind:'PAID_BUY',status:'AWAITING_CONFIRMATION',walletScope:scopes[0],candidateId:candidate.id}});
 brief=await db.researchBrief.create({data:{runId:run.id,candidateId:candidate.id,chainId:'56',contractAddress:address,bodyMd:'Disposable smoke fixture'}});
 const confirmation=await db.userSpendConfirm.create({data:{runId:run.id,briefId:brief.id,chainId:'56',contractAddress:address,amount:'1',asset:'BNB',fromToken:address,walletAddress:address,confirmationText:'SMOKE ONLY',quoteJson:{},expiresAt:new Date(Date.now()+60000)}});
 const attempts=await Promise.allSettled([store.claimExecution(run.id,confirmation.id),store.claimExecution(run.id,confirmation.id)]);
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);
 assert.ok((await db.userSpendConfirm.findUnique({where:{id:confirmation.id}})).consumedAt);
 await Promise.all([store.action(run.id,'fixture.one','INFO',{sessionToken:'DO_NOT_PERSIST',value:'0'}),store.action(run.id,'fixture.two','DENY',{clientId:'DO_NOT_PERSIST',nested:{accessToken:'DO_NOT_PERSIST'}})]);
 const actions=await db.agentAction.findMany({where:{runId:run.id},orderBy:{seq:'asc'}});
 assert.deepEqual(actions.map(a=>a.seq),[1,2]);assert.ok(!JSON.stringify(actions).includes('DO_NOT_PERSIST'));
 for(const scope of scopes) await activity.save([{walletScope:scope,walletAddress:address,chainId:'56',txHash:hash,type:'MINT',providerType:'mint',status:'confirmed',txTime:new Date(),movements:[],networkFee:{}}]);
 await activity.save([{walletScope:scopes[0],walletAddress:address,chainId:'56',txHash:hash,type:'MINT',providerType:'mint',status:'confirmed',txTime:new Date(),movements:[],networkFee:{}}]);
 const listed=await activity.list(scopes[0]);assert.equal(listed.items.length,1);assert.equal(listed.items[0].walletScope,scopes[0]);
 let release;const held=store.withLease(tag,()=>new Promise(resolve=>{release=resolve;}));
 while(!release) await new Promise(resolve=>setTimeout(resolve,5));
 await assert.rejects(()=>store.withLease(tag,async()=>{}),error=>error.code==='AGENT_BUSY');release();await held;
 console.log('PASS: atomic confirmation consumption, ordered/redacted actions, wallet isolation, history deduplication, DB lease exclusion');
} finally {
 await db.walletActivity.deleteMany({where:{walletScope:{in:scopes}}});
 if(run){await db.userSpendConfirm.deleteMany({where:{runId:run.id}});await db.researchBrief.deleteMany({where:{runId:run.id}});await db.agentNotification.deleteMany({where:{runId:run.id}});await db.agentRun.deleteMany({where:{id:run.id}});}
 if(candidate)await db.mintCandidate.deleteMany({where:{id:candidate.id}});
 await db.agentLease.deleteMany({where:{key:tag}});await db.$disconnect();
}
