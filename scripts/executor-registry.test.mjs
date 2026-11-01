import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile), script=fileURLToPath(new URL('./import-executor-registry.mjs',import.meta.url));
const scope=n=>'EVM:0x'+String(n).repeat(40);
async function fixture(entries,existing,check) {
  const dir=await mkdtemp(join(tmpdir(),'registry-test-')), path=join(dir,'registry.json'), requests=[];
  await writeFile(path,JSON.stringify({schema:'snk-onchain-agent/executor-registry@1',executors:entries}));
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req) body+=chunk;
    requests.push({method:req.method,path:req.url,body:body?JSON.parse(body):null});
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({code:0,data:req.method==='GET'?existing:{}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const run=(args=[],extra={})=>exec(process.execPath,[script,'--file',path,...args],{env:{...process.env,SNK_API_BASE:`http://127.0.0.1:${server.address().port}/api/v1`,...extra}});
  try {await check(run,requests);} finally {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await rm(dir,{recursive:true,force:true});}
}
test('registers dynamic IDs without inferring defaults or online status',async()=>{
  await fixture([{id:'w17',walletScope:scope(1),roles:['FREE_MINT'],enabled:true}],[],async(run,requests)=>{
    await run();
    assert.deepEqual(requests[1].body,{id:'w17',walletScope:scope(1),label:'w17',role:'FREE_MINT',sourceRoles:['FREE_MINT']});
    assert.equal(requests[1].method,'POST');
  });
});
test('does not rebind an existing ID to a different wallet',async()=>{
  await fixture([{id:'w3',walletScope:scope(1),roles:['PAID'],enabled:true}],[{id:'w3',walletScope:scope(2)}],async(run,requests)=>{
    await assert.rejects(run,e=>e.stdout.includes('EXECUTOR_WALLET_BOUND'));
    assert.equal(requests.length,1);
  });
});
test('disabled entries pause existing wallets and enabling preserves user pause/default',async()=>{
  const entries=[{id:'w3',walletScope:scope(1),roles:['FREE_MINT'],enabled:false},{id:'w4',walletScope:scope(2),roles:['PAID'],enabled:true}];
  await fixture(entries,[{id:'w3',walletScope:scope(1)},{id:'w4',walletScope:scope(2),paused:true,isDefault:true}],async(run,requests)=>{
    await run(); assert.deepEqual(requests[1].body,{paused:true});
    assert.deepEqual(requests[2].body,{label:'w4',role:'PAID',sourceRoles:['PAID']});
  });
});
test('validates the whole file before writes, rejects ambiguous roles and remote URLs',async()=>{
  const entries=[{id:'w3',walletScope:scope(1),roles:['FREE_MINT'],enabled:true},{id:'w4',walletScope:scope(2),roles:['FREE_MINT','PAID'],enabled:true}];
  await fixture(entries,[],async(run,requests)=>{
    await assert.rejects(run,e=>e.stderr.includes('one explicit execution role'));
    assert.equal(requests.length,0);
    await assert.rejects(()=>run([], {SNK_API_BASE:'https://example.com/api/v1'}),e=>e.stderr.includes('loopback'));
  });
});

test('preserves Grok collaboration/standby roles and agent identity without granting standby execution',async()=>{
  const entries=[
    {id:'w1',walletScope:scope(1),roles:['FREE_MINT','COLLAB'],enabled:true,agentId:'free.ai'},
    {id:'w3',walletScope:scope(3),roles:['STANDBY','COLLAB'],enabled:true,agentId:'backup.ai'},
  ];
  await fixture(entries,[],async(run,requests)=>{
    await run();
    assert.equal(requests[1].body.role,'FREE_MINT');
    assert.deepEqual(requests[1].body.sourceRoles,['FREE_MINT','COLLAB']);
    assert.equal(requests[2].body.role,'MONITOR');
    assert.deepEqual(requests[2].body.sourceRoles,['STANDBY','COLLAB']);
    assert.equal(requests[2].body.agentId,'backup.ai');
    assert.equal(requests[2].body.state,undefined);
  });
});
