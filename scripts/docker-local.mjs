// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const action = process.argv[2];
if (!['up', 'down'].includes(action)) throw new Error('Usage: node scripts/docker-local.mjs <up|down>');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(args) {
  const result = spawnSync('docker', args, { cwd: project, encoding: 'utf8', shell: false, windowsHide: true });
  if (result.error) throw new Error(`Could not start Docker CLI: ${result.error.message}`);
  return result;
}

const contextResult = run(['context', 'show']);
if (contextResult.status !== 0) throw new Error(`Could not inspect selected Docker context: ${contextResult.stderr.trim()}`);
const context = contextResult.stdout.trim();
if (!/^[A-Za-z0-9_.-]+$/.test(context)) throw new Error('Docker returned an invalid context name.');
console.log(`Selected Docker context: ${context}`);

const engine = run(['--context', context, 'info', '--format', '{{.Name}} {{.OSType}} {{.ServerVersion}}']);
if (engine.status !== 0) {
  throw new Error(`Docker engine for context "${context}" is unavailable; Compose was not run. ${engine.stderr.trim()}`);
}
console.log(`Verified Docker engine: ${engine.stdout.trim()}`);

const compose = run(['--context', context, 'compose', '-f', 'compose.midnight-local.yaml', action === 'up' ? 'up' : 'down', ...(action === 'up' ? ['-d', '--wait'] : [])]);
if (compose.stdout) process.stdout.write(compose.stdout);
if (compose.stderr) process.stderr.write(compose.stderr);
process.exitCode = compose.status ?? 2;
