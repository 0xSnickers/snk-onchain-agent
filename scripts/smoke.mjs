import assert from 'node:assert/strict';
const base = process.env.SMOKE_API_BASE || 'http://127.0.0.1:9010/api/v1';
async function request(path, options) {
  const r = await fetch(base + path, options); return { status: r.status, body: await r.json() };
}
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
assert.equal((await request('/health')).body.data.database, 'connected');
assert.equal((await request('/kols', json({ handle: 'invalid handle!' }))).status, 400);
assert.equal((await request('/market/pairs?chain=invalid')).status, 400);
assert.equal((await request('/kols/not-a-uuid', { method: 'DELETE' })).status, 400);
assert.equal((await request('/wallet/signin', { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
const handle = `snk${Date.now().toString(36)}`;
let id;
try {
  const added = await request('/kols', json({ handle, note: 'smoke-test' }));
  assert.equal(added.status, 201); id = added.body.data.id;
  assert.ok((await request('/kols')).body.data.accounts.some(k => k.id === id));
  const again = await request('/kols', json({ handle: handle.toUpperCase(), note: 'updated' }));
  assert.equal(again.body.data.id, id);
  assert.equal(again.body.data.note, 'updated');
} finally { if (id) await request(`/kols/${id}`, { method: 'DELETE' }); }
assert.ok(!(await request('/kols')).body.data.accounts.some(k => k.id === id));
console.log('PASS: health, PostgreSQL CRUD/upsert, validation, origin protection, cleanup (10 checks)');

await import("./agent-smoke.mjs");
await import('./market-social-smoke.mjs');
await import('./delegation-smoke.mjs');
