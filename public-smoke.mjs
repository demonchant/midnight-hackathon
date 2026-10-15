import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectUploaded } from './public-inspect.mjs';

const policyText = await readFile(new URL('./examples/ledger-schema-smoke.policy.json', import.meta.url), 'utf8');
const sourceText = await readFile(new URL('./examples/ledger-schema-smoke.compact', import.meta.url), 'utf8');
const mutatedText = await readFile(new URL('./examples/ledger-schema-smoke-mutated.compact', import.meta.url), 'utf8');
const matching = await inspectUploaded({ sourceText, policyText, sourceName: 'ledger-schema-smoke.compact', policyName: 'ledger-schema-smoke.policy.json' });
assert.equal(matching.result, 'PASS');
console.log('PASS: matching public compiler smoke source and policy.');
const mutated = await inspectUploaded({ sourceText: mutatedText, policyText, sourceName: 'ledger-schema-smoke-mutated.compact', policyName: 'ledger-schema-smoke.policy.json' });
assert.equal(mutated.result, 'BLOCKED');
assert(mutated.changes.some(change => change.kind === 'unapproved' && change.name === 'revision'));
console.log('PASS: mutated public compiler smoke source is blocked for unapproved revision.');
