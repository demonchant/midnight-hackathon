import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from '../inspect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyRelative = 'examples/ledger-schema-smoke.policy.json';
const compactBin = process.env.COMPACT_BIN || 'compact';

const matching = await inspect({
  root,
  sourceRelative: 'examples/ledger-schema-smoke.compact',
  policyRelative,
  compactBin
});
assert.equal(matching.result, 'PASS', 'compiler-produced baseline metadata should match the reviewed policy');
console.log(`PASS: compiler-backed baseline matched (${matching.toolchain.compiler}/${matching.toolchain.runtime}).`);

const mutated = await inspect({
  root,
  sourceRelative: 'examples/ledger-schema-smoke-mutated.compact',
  policyRelative,
  compactBin
});
assert.equal(mutated.result, 'BLOCKED', 'a public schema change should be blocked after successful compilation');
assert(mutated.changes.some(change => change.kind === 'unapproved' && change.name === 'revision'));
console.log('PASS: successfully compiled schema mutation was BLOCKED for unapproved revision.');

await assert.rejects(
  inspect({
    root,
    sourceRelative: 'examples/invalid-compiler-input.compact',
    policyRelative,
    compactBin
  }),
  error => error.code === 'COMPILE_FAILED',
  'compiler syntax failure must remain an ERROR rather than a policy BLOCKED result'
);
console.log('PASS: compiler failure remained a COMPILATION ERROR, separate from policy BLOCKED.');
