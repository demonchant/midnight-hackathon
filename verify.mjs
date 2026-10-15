import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareLedger, compareToolchain, extractLedger, GateError, validatePolicy } from './core.mjs';
import { withinRoot } from './inspect.mjs';

// Test-only copy of the user's observed metadata shape; not loaded by the product path or live CLI.
const metadataFixture = {
  'compiler-version': '0.31.1', 'language-version': '0.23.0', 'runtime-version': '0.16.0',
  ledger: [{ name: 'message', index: 0, exported: true, storage: 'Cell', type: { 'type-name': 'Opaque', tsType: 'string' } }]
};
const policyFixture = { formatVersion: 1, toolchain: { compiler: '0.31.1', language: '0.23.0', runtime: '0.16.0' }, ledger: [
  { name: 'message', index: 0, exported: true, storage: 'Cell', type: { 'type-name': 'Opaque', tsType: 'string' }, reason: 'Unit test fixture' }
] };

assert.deepEqual(extractLedger(metadataFixture), policyFixture.ledger.map(({ reason, ...field }) => field));
assert.deepEqual(compareLedger(extractLedger(metadataFixture), policyFixture), []);
assert.deepEqual(compareToolchain({ compiler: '0.31.1', language: '0.23.0', runtime: '0.16.0' }, policyFixture), []);
assert.deepEqual(compareToolchain({ compiler: '0.31.2', language: '0.23.0', runtime: '0.16.0' }, policyFixture).map(x => x.kind), ['toolchain-changed']);
assert.deepEqual(compareLedger([...extractLedger(metadataFixture), { name: 'newField', index: 2, exported: true, storage: 'persistent', type: 'String' }], policyFixture).map(x => x.kind), ['unapproved']);
assert.deepEqual(compareLedger([{ ...extractLedger(metadataFixture)[0], exported: false }], { ...policyFixture, ledger: [policyFixture.ledger[0]] }).map(x => x.kind), ['changed']);
assert.throws(() => extractLedger({ compiler: { ledger: [{ name: 'x', index: 0, exported: true, storage: 'Cell', type: 'String' }] } }), e => e instanceof GateError && e.code === 'UNSUPPORTED_METADATA');
assert.throws(() => extractLedger({ ledger: [{ name: 'x', index: 0, exported: true, storage: 'Cell', type: 'String' }, { name: 'y', index: 0, exported: false, storage: 'Cell', type: 'String' }] }), e => e instanceof GateError && e.code === 'INVALID_METADATA');
assert.throws(() => validatePolicy({ formatVersion: 1, ledger: [{ name: 'x' }] }), e => e.code === 'INVALID_POLICY');
assert.throws(() => validatePolicy({ ...policyFixture, ledger: [policyFixture.ledger[0], { ...policyFixture.ledger[0], reason: 'duplicate name' }] }), e => e.code === 'INVALID_POLICY' && /Duplicate policy field name/.test(e.message));
assert.throws(() => validatePolicy({ ...policyFixture, ledger: [policyFixture.ledger[0], { ...policyFixture.ledger[0], name: 'other', reason: 'duplicate index' }] }), e => e.code === 'INVALID_POLICY' && /Duplicate policy ledger index/.test(e.message));
assert.throws(() => validatePolicy({ ...policyFixture, ledger: [{ ...policyFixture.ledger[0], index: -1 }] }), e => e.code === 'INVALID_POLICY');
assert.throws(() => validatePolicy({ ...policyFixture, toolchain: { ...policyFixture.toolchain, extra: 'unsupported' } }), e => e.code === 'INVALID_POLICY');
assert.throws(() => validatePolicy({ ...policyFixture, toolchain: { ...policyFixture.toolchain, runtime: '' } }), e => e.code === 'INVALID_POLICY');
assert.deepEqual(compareLedger([], policyFixture).map(x => x.kind), ['removed']);
assert.deepEqual(compareLedger(extractLedger(metadataFixture), { ...policyFixture, ledger: [{ ...policyFixture.ledger[0], index: 1 }] }).map(x => x.kind), ['changed']);
assert.throws(() => extractLedger({ ledger: [{ name: 'x', index: -1, exported: true, storage: 'Cell', type: 'String' }] }), e => e.code === 'INVALID_METADATA');
const tempRoot = await mkdtemp(path.join(tmpdir(), 'cpg-unit-'));
try {
  await mkdir(path.join(tempRoot, 'contracts'));
  await writeFile(path.join(tempRoot, 'contracts', 'sample.compact'), 'test-only path fixture');
  assert.equal(await withinRoot(tempRoot, 'contracts/sample.compact'), path.join(tempRoot, 'contracts', 'sample.compact'));
  await assert.rejects(withinRoot(tempRoot, '../outside.compact'), e => e.code === 'INVALID_PATH' || e.code === 'PATH_OUTSIDE_ROOT');
} finally { await rm(tempRoot, { recursive: true, force: true }); }
console.log('PASS: 19 deterministic assertions (test fixtures only; no compiler integration exercised).');
