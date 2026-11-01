#!/usr/bin/env node
// Multi-wallet, transactional import. No CLI/session data is read.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'server/package.json'));
require('dotenv').config({ path: join(root, 'server/.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const dry = process.argv.includes('--dry-run');
const pathArg = process.argv.indexOf('--file');
const path = pathArg >= 0 ? process.argv[pathArg + 1] : join(root, 'data/baw-free-mints.json');
const doc = JSON.parse(readFileSync(path, 'utf8'));
const address = v => typeof v === 'string' && /^0x(?!0{40}$)[a-f0-9]{40}$/i.test(v);
if (doc.schema !== 'snk-onchain-agent/baw-free-mints@1' || !Array.isArray(doc.mints)) throw new Error('LEDGER_INVALID: unsupported schema');
const normalizedScope = value => typeof value === 'string' && /^EVM:0x(?!0{40}$)[a-f0-9]{40}$/i.test(value) ? 'EVM:'+value.slice(4).toLowerCase() : null;
const rows = doc.mints.map(m => {
  const walletScope = normalizedScope(m.walletScope === undefined ? doc.walletScope : m.walletScope);
  const walletAddress = String(m.walletAddress || walletScope?.slice(4) || doc.walletAddress || '').toLowerCase();
  const contractAddress = String(m.contractAddress || m.contract || '').toLowerCase();
  const txHash = String(m.txHash || '').toLowerCase();
  const mintedAt = new Date(m.mintedAt);
  if (!address(walletAddress) || walletScope !== `EVM:${walletAddress}` || !address(contractAddress) || !/^0x[a-f0-9]{64}$/.test(txHash) || !Number.isFinite(mintedAt.getTime()) || String(m.chainId || '56') !== '56') throw new Error('LEDGER_INVALID: wallet scope, contract, hash, chain or timestamp mismatch');
  if ((m.valueWei !== undefined && m.valueWei !== '0') || m.previewClean === false || m.gasOnly === false) throw new Error('LEDGER_INVALID: not a successful free mint');
  return { walletScope, walletAddress, contractAddress, txHash, mintedAt, name: typeof m.name === 'string' ? m.name.slice(0, 100) : null, symbol: typeof m.symbol === 'string' ? m.symbol.slice(0, 30) : null, batchId: typeof (m.batchId || m.batch) === 'string' ? (m.batchId || m.batch).slice(0, 100) : null };
});
if (doc.walletAddress && doc.walletScope !== undefined && normalizedScope(doc.walletScope) !== `EVM:${String(doc.walletAddress).toLowerCase()}`) throw new Error('LEDGER_INVALID: default wallet mismatch');
const db = new PrismaClient();
async function importRow(m) {
  return db.$transaction(async tx => {
    // Shared with callback to prevent concurrent duplicate imports.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(882911)`;
    const key = {walletScope: m.walletScope, chainId: '56', txHash: m.txHash};
    const existing = await tx.walletActivity.findUnique({where: {walletScope_chainId_txHash: key}});
    if (existing) return false;
    const candidate = await tx.mintCandidate.upsert({where: {chainId_contractAddress: {chainId: '56', contractAddress: m.contractAddress}}, create: {chainId: '56', contractAddress: m.contractAddress, name: m.name, symbol: m.symbol, class: 'FREE_MINT', status: 'MINTED', source: 'GROK_BOT_LEDGER'}, update: {status: 'MINTED'}});
    const run = await tx.agentRun.create({data: {kind: 'FREE_MINT', status: 'SUCCEEDED', trigger: 'WEBHOOK', walletScope: m.walletScope, candidateId: candidate.id, summary: 'Imported Grok Bot free mint ledger', startedAt: m.mintedAt, finishedAt: m.mintedAt, actionSeq: 1, contextJson: {imported: true, batchId: m.batchId}, actions: {create: {seq: 1, name: 'import.ledger', decision: 'INFO', txHash: m.txHash, detailJson: {source: 'GROK_BOT_LEDGER', verification: 'AGENT_REPORTED'}, createdAt: m.mintedAt}}}});
    await tx.walletActivity.create({data: {...key, walletAddress: m.walletAddress, type: 'MINT', providerType: 'DELEGATED', status: 'SUCCESS', txTime: m.mintedAt, movements: [], source: 'GROK_BOT_LEDGER'}});
    await tx.mintCandidate.update({where: {id: candidate.id}, data: {lastRunId: run.id}});
    return true;
  });
}
try {
  let imported = 0;
  if (!dry) for (const m of rows) if (await importRow(m)) imported++;
  console.log(JSON.stringify({dry, records: rows.length, wallets: new Set(rows.map(m => m.walletScope)).size, imported, skipped: dry ? 0 : rows.length - imported}));
} catch {
  console.error('LEDGER_IMPORT_FAILED: database import failed; ledger retained for retry');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
