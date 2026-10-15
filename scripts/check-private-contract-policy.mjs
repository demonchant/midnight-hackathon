import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from '../inspect.mjs';
import { GateError } from '../core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const report = await inspect({
    root,
    sourceRelative: 'contracts/private-access-counter.compact',
    policyRelative: 'contracts/private-access-counter.policy.json',
    compactBin: process.env.COMPACT_BIN || 'compact'
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (error) {
  const failure = error instanceof GateError ? error : new GateError('INTERNAL_ERROR', error.message);
  console.error(JSON.stringify({ result: 'ERROR', code: failure.code, message: failure.message }, null, 2));
  process.exitCode = 2;
}
