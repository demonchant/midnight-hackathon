#!/usr/bin/env node
import path from 'node:path';
import { inspect } from './inspect.mjs';
import { GateError } from './core.mjs';
import { loadConfig } from './config.mjs';

await loadConfig();

const [sourceRelative, flag, policyRelative] = process.argv.slice(2);
const root = process.env.CPG_PROJECT_ROOT;
if (!root) { console.error('BLOCKED: set CPG_PROJECT_ROOT to a real Compact project directory.'); process.exit(2); }
if (!sourceRelative || flag !== '--policy' || !policyRelative) {
  console.error('Usage: node cli.mjs <source.compact-relative-path> --policy <policy.json-relative-path>'); process.exit(2);
}
try {
  const report = await inspect({ root: path.resolve(root), sourceRelative, policyRelative, compactBin: process.env.COMPACT_BIN || 'compact' });
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (error) {
  const e = error instanceof GateError ? error : new GateError('INTERNAL_ERROR', error.message);
  console.error(JSON.stringify({ result: 'ERROR', code: e.code, message: e.message }, null, 2));
  process.exitCode = 2;
}
