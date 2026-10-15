import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function reservePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function launchServer(extraEnv = {}) {
  const port = await reservePort();
  const processServer = spawn(process.execPath, ['public-server.mjs'], {
    env: { ...process.env, CPG_TRUST_PROXY: '0', CPG_PUBLIC_HOST: '127.0.0.1', CPG_PUBLIC_PORT: String(port), ...extraEnv },
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(`${base}/api/status`)).ok) return { processServer, base };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  processServer.kill('SIGTERM');
  throw new Error('public server did not start');
}

async function stopServer(processServer) {
  if (processServer.exitCode !== null) return;
  processServer.kill('SIGTERM');
  await new Promise(resolve => processServer.once('exit', resolve));
}

const postInspect = (base, input) => fetch(`${base}/api/inspect`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input)
});
const policyText = await readFile(new URL('./examples/ledger-schema-smoke.policy.json', import.meta.url), 'utf8');
const matchingSource = await readFile(new URL('./examples/ledger-schema-smoke.compact', import.meta.url), 'utf8');
const mutatedSource = await readFile(new URL('./examples/ledger-schema-smoke-mutated.compact', import.meta.url), 'utf8');

const { processServer, base } = await launchServer();
try {
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.mode, 'public-upload');
  assert.equal(status.ready, true);
  assert.equal(status.maxInspectionsPerClientPerWindow, 8);
  assert.equal(status.maxInspectionsGlobalPerWindow, 32);
  assert.equal(status.maxConcurrentInspections, 1);
  assert.equal((await fetch(`${base}/api/local-contract/run`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${base}/app`)).status, 200);
  assert.equal((await fetch(`${base}/landing.css`)).status, 200);
  assert.match(await (await fetch(`${base}/app`)).text(), /Run passing example/);
  assert.match(await (await fetch(`${base}/samples/ledger-schema-smoke.compact`)).text(), /ledger-schema-smoke/);
  assert.match(await (await fetch(`${base}/samples/ledger-schema-smoke.policy.json`)).headers.get('content-type'), /application\/json/);
  assert.match(await (await fetch(`${base}/samples/ledger-schema-smoke-mutated.compact`)).text(), /revision/);

  const invalid = await postInspect(base, {
    sourceName: 'a.compact', sourceText: 'source', policyName: 'p.json', policyText: '{'
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_POLICY_JSON');

  const oversizedSource = await postInspect(base, {
    sourceName: 'a.compact', sourceText: 'x'.repeat(256 * 1024 + 1), policyName: 'p.json', policyText: '{}'
  });
  assert.equal(oversizedSource.status, 413);
  assert.equal((await oversizedSource.json()).code, 'SOURCE_TOO_LARGE');

  const oversizedPolicy = await postInspect(base, {
    sourceName: 'a.compact', sourceText: 'x', policyName: 'p.json', policyText: ' '.repeat(64 * 1024 + 1)
  });
  assert.equal(oversizedPolicy.status, 413);
  assert.equal((await oversizedPolicy.json()).code, 'POLICY_TOO_LARGE');

  const oversizedRequest = await postInspect(base, {
    sourceName: 'a.compact', sourceText: 'x'.repeat(2 * 1024 * 1024), policyName: 'p.json', policyText: '{}'
  });
  assert.equal(oversizedRequest.status, 413);
  assert.equal((await oversizedRequest.json()).code, 'REQUEST_TOO_LARGE');

  const matching = await postInspect(base, {
    sourceName: 'ledger-schema-smoke.compact', sourceText: matchingSource,
    policyName: 'ledger-schema-smoke.policy.json', policyText
  });
  assert.equal(matching.status, 200);
  assert.equal((await matching.json()).result, 'PASS');

  const invalidSource = await postInspect(base, {
    sourceName: 'broken.compact', sourceText: 'pragma language_version 0.23; export circuit broken(',
    policyName: 'ledger-schema-smoke.policy.json', policyText
  });
  assert.equal(invalidSource.status, 422);
  const compileError = await invalidSource.json();
  assert.equal(compileError.code, 'COMPILATION_FAILED');
  assert.match(compileError.message, /No schema policy decision was made/);
  assert.equal(typeof compileError.details, 'string');

  const mutated = await postInspect(base, {
    sourceName: 'ledger-schema-smoke-mutated.compact', sourceText: mutatedSource,
    policyName: 'ledger-schema-smoke.policy.json', policyText
  });
  assert.equal(mutated.status, 409);
  const mutatedReport = await mutated.json();
  assert(mutatedReport.changes.some(change => change.kind === 'unapproved' && change.name === 'revision'));
  console.log('PASS: public routes, matching/mutated/invalid-source compiler uploads, invalid policy JSON, and request/source/policy size limits.');
} finally {
  await stopServer(processServer);
}

const beforeTimeout = execFileSync('docker', [
  'ps', '-aq', '--filter', 'label=cpg.compact-gate=public-compiler'
], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
const timeoutServer = await launchServer({ CPG_COMPILE_TIMEOUT_MS: '1' });
try {
  const timedOut = await postInspect(timeoutServer.base, {
    sourceName: 'ledger-schema-smoke.compact', sourceText: matchingSource,
    policyName: 'ledger-schema-smoke.policy.json', policyText
  });
  assert.equal(timedOut.status, 504);
  assert.equal((await timedOut.json()).code, 'PROCESS_TIMEOUT');
} finally {
  await stopServer(timeoutServer.processServer);
}
const afterTimeout = execFileSync('docker', [
  'ps', '-aq', '--filter', 'label=cpg.compact-gate=public-compiler'
], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
assert.equal(afterTimeout, beforeTimeout, 'timed-out compiler container should be removed');
console.log('PASS: forced compile timeout returns 504 and leaves no labeled compiler container behind.');

const rateServer = await launchServer({ CPG_TRUST_PROXY: '1' });
try {
  const rateLimitedPost = (ip) => fetch(`${rateServer.base}/api/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ sourceName: 'a.compact', sourceText: 'source', policyName: 'p.json', policyText: '{' })
  });
  for (let requestIndex = 0; requestIndex < 8; requestIndex++) {
    assert.equal((await rateLimitedPost('192.0.2.1')).status, 400);
  }
  const perClientLimited = await rateLimitedPost('192.0.2.1');
  assert.equal(perClientLimited.status, 429);
  assert.equal((await perClientLimited.json()).code, 'RATE_LIMITED');

  for (let ipIndex = 2; ipIndex <= 4; ipIndex++) {
    for (let requestIndex = 0; requestIndex < 8; requestIndex++) {
      assert.equal((await rateLimitedPost(`192.0.2.${ipIndex}`)).status, 400);
    }
  }
  const globalLimited = await rateLimitedPost('192.0.2.5');
  assert.equal(globalLimited.status, 429);
  assert.equal((await globalLimited.json()).code, 'GLOBAL_RATE_LIMITED');
} finally {
  await stopServer(rateServer.processServer);
}
console.log('PASS: public API enforces per-client and global inspection rate limits.');
