import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rawBase = process.env.PUBLIC_BASE_URL;
if (!rawBase) throw new Error('Set PUBLIC_BASE_URL to the deployed public app URL.');
const base = new URL(rawBase);
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(base.hostname)) {
  throw new Error('Hosted verification requires HTTPS. HTTP is allowed only on loopback.');
}
base.pathname = base.pathname.replace(/\/$/, '');

async function request(path, options) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(240_000) });
  return response;
}

const landing = await request('/', {});
assert.equal(landing.status, 200);
assert.match(landing.headers.get('content-type') || '', /text\/html/);
assert.equal(landing.headers.get('x-content-type-options'), 'nosniff');
assert.match(await landing.text(), /Compact Privacy Change Gate/);

const app = await request('/app', {});
assert.equal(app.status, 200);
assert.match(await app.text(), /Inspect a Compact schema/);

const statusResponse = await request('/api/status', {});
assert.equal(statusResponse.status, 200, 'service status must confirm a ready Compact compiler');
const status = await statusResponse.json();
assert.equal(status.ready, true);
assert.equal(status.mode, 'public-upload');
assert.equal(status.compiler, '0.31.1');
assert(['service-process', 'disposable-container'].includes(status.compilerExecution));
assert.equal(status.maxSourceBytes, 256 * 1024);
assert.equal(status.maxPolicyBytes, 64 * 1024);
assert.equal(status.maxInspectionsPerClientPerWindow, 8);
assert.equal(status.maxInspectionsGlobalPerWindow, 32);
assert.equal(status.maxConcurrentInspections, 1);

const policyText = await readFile(new URL('./examples/ledger-schema-smoke.policy.json', import.meta.url), 'utf8');
const matchingSource = await readFile(new URL('./examples/ledger-schema-smoke.compact', import.meta.url), 'utf8');
const mutatedSource = await readFile(new URL('./examples/ledger-schema-smoke-mutated.compact', import.meta.url), 'utf8');
const invalidSource = await readFile(new URL('./examples/invalid-compiler-input.compact', import.meta.url), 'utf8');
const upload = (sourceName, sourceText) => request('/api/inspect', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sourceName, sourceText, policyName: 'ledger-schema-smoke.policy.json', policyText })
});

const matching = await upload('ledger-schema-smoke.compact', matchingSource);
assert.equal(matching.status, 200);
assert.equal((await matching.json()).result, 'PASS');

const mutated = await upload('ledger-schema-smoke-mutated.compact', mutatedSource);
assert.equal(mutated.status, 409);
const blocked = await mutated.json();
assert.equal(blocked.result, 'BLOCKED');
assert(blocked.changes.some(change => change.kind === 'unapproved' && change.name === 'revision'));

const invalid = await upload('invalid-compiler-input.compact', invalidSource);
assert.equal(invalid.status, 422);
const compileError = await invalid.json();
assert.equal(compileError.result, 'ERROR');
assert.equal(compileError.code, 'COMPILATION_FAILED');

const noDeploymentRoute = await request('/api/local-contract/run', { method: 'POST' });
assert.equal(noDeploymentRoute.status, 404, 'the public upload service must not expose the local contract runner');

console.log(`PASS: deployed app verified at ${base.origin} (HTTPS, ready compiler, baseline PASS, schema BLOCKED, compiler error, no local deployment route).`);
