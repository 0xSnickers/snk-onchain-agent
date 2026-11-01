#!/usr/bin/env node
// Loopback-only adapter for an executor running on this host. Never calls baw.
import {readFile} from 'node:fs/promises';
const [action, ...args] = process.argv.slice(2);
const allowed = new Set(['--executor','--scope','--id','--file','--state','--paused']);
const options={};
for(let i=0;i<args.length;i+=2) {
  if(!allowed.has(args[i]) || !args[i+1]) throw new Error('Unknown option or missing value');
  options[args[i].slice(2)]=args[i+1];
}
const base='http://127.0.0.1:9010/api/v1';
const executorOk = (id) => /^[a-z][a-z0-9_-]{0,31}$/.test(id || '');
const scopeOk = (s) => /^EVM:0x(?!0{40}$)[a-f0-9]{40}$/.test(s || '');
async function call(path,body,method='POST') {
  const response=await fetch(base+path,body ? {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
  const data=await response.json();
  if(!response.ok) throw new Error(`${data.code}: ${data.message}`);
  console.log(JSON.stringify(data.data,null,2));
}
const identity=()=>{
  if(!executorOk(options.executor) || !scopeOk(options.scope)) throw new Error('Provide --executor <id> (^[a-z][a-z0-9_-]{0,31}$) and --scope EVM:0x...');
  return {executorId:options.executor,walletScope:options.scope};
};
try {
  if(action==='register') {
    if(!options.file) throw new Error('Provide --file executor.json');
    await call('/delegation/executors',JSON.parse(await readFile(options.file,'utf8')));
  } else if(action==='configure') {
    if(!/^[a-z][a-z0-9_-]{0,31}$/.test(options.executor || '')) throw new Error('Provide a valid --executor ID');
    if(!options.file) throw new Error('Provide --file config.json');
    await call(`/delegation/executors/${options.executor}`,JSON.parse(await readFile(options.file,'utf8')), 'PATCH');
  } else if(action==='heartbeat') {
    const {executorId,walletScope}=identity();
    const state=options.state || 'UNCONNECTED';
    if(!['CONNECTED','UNCONNECTED'].includes(state)) throw new Error('Invalid state');
    const body={walletScope,state};
    if(options.paused!==undefined) {
      if(!['true','false'].includes(options.paused)) throw new Error('Invalid paused flag');
      body.paused=options.paused==='true';
    }
    await call(`/delegation/sessions/${executorId}`,body);
  } else if(action==='list') {
    if(!executorOk(options.executor)) throw new Error('Provide --executor <id>');
    await call(`/delegation/outbox?executorId=${options.executor}`);
  } else if(action==='claim') {
    const input=identity();
    if(!/^[a-f0-9-]{36}$/.test(options.id || '')) throw new Error('Provide --id UUID');
    await call(`/delegation/outbox/${options.id}/claim`,input);
  } else if(action==='result') {
    if(!/^[a-f0-9-]{36}$/.test(options.id || '') || !options.file) throw new Error('Provide --id UUID and --file result.json');
    await call(`/delegation/outbox/${options.id}/result`,JSON.parse(await readFile(options.file,'utf8')));
  } else throw new Error('Usage: delegation-client register|configure|heartbeat|list|claim|result — executor ids are dynamic (w1, w2, w3, …)');
} catch(error) { console.error(error.message); process.exitCode=1; }
