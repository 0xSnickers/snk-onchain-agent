#!/usr/bin/env node
// Import public executor metadata over loopback; never credentials or baw sessions.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const args=process.argv.slice(2), dry=args.includes('--dry-run'), fileIdx=args.indexOf('--file');
const file=resolve(fileIdx>=0 ? args[fileIdx+1] : 'data/executor-registry.json');
const base=new URL(process.env.SNK_API_BASE || 'http://127.0.0.1:9010/api/v1');
if(base.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash) throw new Error('SNK_API_BASE must be a loopback HTTP API');
const doc=JSON.parse(await readFile(file,'utf8'));
if(doc.schema!=='snk-onchain-agent/executor-registry@1' || !Array.isArray(doc.executors)) throw new Error('Invalid executor registry');
const ids=new Set(), scopes=new Set(), defaults=new Set();
const entries=doc.executors.map(ex=>{
  if(!ex || !/^[a-z][a-z0-9_-]{0,31}$/.test(ex.id) || !/^EVM:0x(?!0{40}$)[a-f0-9]{40}$/.test(ex.walletScope) || typeof ex.enabled!=='boolean') throw new Error('Invalid executor ID, wallet scope or enabled flag');
  if(ex.walletAddress && ex.walletAddress.toLowerCase()!==ex.walletScope.slice(4)) throw new Error('Executor wallet address/scope mismatch');
  if(ids.has(ex.id) || scopes.has(ex.walletScope)) throw new Error('Duplicate executor ID or wallet');
  ids.add(ex.id); scopes.add(ex.walletScope);
  if(!Array.isArray(ex.roles) || ex.roles.length>5 || new Set(ex.roles).size!==ex.roles.length || ex.roles.some(r=>!['FREE_MINT','PAID','MONITOR','COLLAB','STANDBY'].includes(r))) throw new Error('Invalid registry roles');
  const executionRoles=ex.roles.filter(r=>['FREE_MINT','PAID'].includes(r));
  if(executionRoles.length>1) throw new Error('Configure one explicit execution role per executor');
  const role=ex.roles.includes('STANDBY') ? 'MONITOR' : executionRoles[0] || 'MONITOR';
  if(ex.agentId!==undefined && ex.agentId!==null && (typeof ex.agentId!=='string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(ex.agentId))) throw new Error('Invalid Agent ID');
  if(ex.isDefault!==undefined && typeof ex.isDefault!=='boolean') throw new Error('Invalid default flag');
  if(ex.isDefault && (role==='MONITOR' || defaults.has(role))) throw new Error('Each execution role may have only one default');
  if(ex.isDefault) defaults.add(role);
  if(ex.label!==undefined && (typeof ex.label!=='string' || ex.label.length>80)) throw new Error('Invalid wallet label');
  return {id:ex.id,walletScope:ex.walletScope,label:ex.label || ex.id,role,sourceRoles:ex.roles,...(ex.agentId===undefined?{}:{agentId:ex.agentId}),enabled:ex.enabled,...(ex.isDefault===undefined?{}:{isDefault:ex.isDefault})};
});
async function call(method,path,body) {
  const res=await fetch(base.href.replace(/\/$/,'')+path,{method,redirect:'error',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json(); return {ok:res.ok,status:res.status,data};
}
if(dry) console.log(JSON.stringify({file,dry,executors:entries},null,2));
else {
  const listed=await call('GET','/delegation/sessions');
  if(!listed.ok) throw new Error('Executor list unavailable');
  const existing=new Map(listed.data.data.map(s=>[s.id,s])), results=[];
  for(const ex of entries) {
    const old=existing.get(ex.id);
    if(old && old.walletScope!==ex.walletScope) {results.push({id:ex.id,ok:false,code:'EXECUTOR_WALLET_BOUND'}); continue;}
    if(!ex.enabled && !old) {results.push({id:ex.id,skipped:'disabled'}); continue;}
    const {enabled,id,...body}=ex;
    const update=enabled ? {label:ex.label,role:ex.role,sourceRoles:ex.sourceRoles,...(ex.agentId===undefined?{}:{agentId:ex.agentId}),...(ex.isDefault===undefined?{}:{isDefault:ex.isDefault})} : {paused:true};
    // Enabling a registry entry never silently resumes a user's paused wallet.
    const r=old ? await call('PATCH',`/delegation/executors/${encodeURIComponent(id)}`,update) : await call('POST','/delegation/executors',{id,...body});
    results.push({id,ok:r.ok,code:r.data.code,status:r.status});
  }
  console.log(JSON.stringify({file,dry,results},null,2));
  if(results.some(r=>r.ok===false)) process.exitCode=1;
}
