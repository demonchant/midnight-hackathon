// SPDX-License-Identifier: Apache-2.0
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(project, 'contracts', 'private-access-counter.compact');
const output = path.join(project, 'contracts', 'managed', 'private-access-counter');
const managedRoot = path.join(project, 'contracts', 'managed') + path.sep;
if (!output.startsWith(managedRoot)) throw new Error('Refusing to compile outside contracts/managed.');

// This target contains generated local build output and is ignored by git.
await rm(output, { recursive: true, force: true });
const bin = process.env.COMPACT_BIN || 'compact';
const child = spawn(bin, ['compile', source, output], { cwd: project, stdio: 'inherit', shell: false });
let settled = false;
child.on('error', error => {
  if (settled) return;
  settled = true;
  console.error(`Could not start Compact CLI "${bin}": ${error.message}`);
  process.exitCode = 2;
});
child.on('close', code => {
  if (settled) return;
  settled = true;
  if (code !== 0) {
    process.exitCode = code ?? 2;
    return;
  }
  access(path.join(output, 'contract', 'index.js')).then(() => {
    process.exitCode = 0;
  }).catch(() => {
    console.error(`Compact exited successfully but did not produce ${path.join(output, 'contract', 'index.js')}.`);
    process.exitCode = 2;
  });
});
