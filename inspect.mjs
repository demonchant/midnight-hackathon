import { mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { compareLedger, compareToolchain, extractLedger, GateError, parseMetadataFile, sha256 } from './core.mjs';

export async function withinRoot(root, relative) {
  if (!relative || path.isAbsolute(relative)) throw new GateError('INVALID_PATH', 'Provide a relative path inside CPG_PROJECT_ROOT.');
  const base = await realpath(root);
  const lexical = path.resolve(base, relative);
  const lexicalRelative = path.relative(base, lexical);
  if (lexicalRelative === '..' || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
    throw new GateError('PATH_OUTSIDE_ROOT', 'Requested path resolves outside CPG_PROJECT_ROOT.');
  }
  const resolved = await realpath(lexical);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new GateError('PATH_OUTSIDE_ROOT', 'Requested path resolves outside CPG_PROJECT_ROOT.');
  return resolved;
}

async function findMetadata(directory) {
  const results = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile() && entry.name === 'contract-info.json') results.push(target);
    }
  }
  await walk(directory);
  if (results.length !== 1) throw new GateError('METADATA_COUNT', `Expected exactly one compiler contract-info.json; found ${results.length}.`);
  return results[0];
}

function runCompiler(bin, source, output, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['compile', source, output], { cwd, shell: false, windowsHide: true });
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const append = (current, chunk) => (current + chunk).slice(-12000);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, 5000).unref();
    }, 10 * 60 * 1000);
    timeout.unref();
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', x => { stdout = append(stdout, x); }); child.stderr.on('data', x => { stderr = append(stderr, x); });
    child.on('error', e => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      reject(new GateError('COMPILER_UNAVAILABLE', `Could not start Compact CLI "${bin}": ${e.message}`));
    });
    child.on('close', code => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (timedOut) reject(new GateError('COMPILE_TIMEOUT', 'Compact compilation exceeded the 10 minute limit and was terminated.'));
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new GateError('COMPILE_FAILED', `Compact compile exited ${code}.\n${stderr || stdout}`));
    });
  });
}

export async function inspect({ root, sourceRelative, policyRelative, compactBin = 'compact' }) {
  const source = await withinRoot(root, sourceRelative);
  const policyPath = await withinRoot(root, policyRelative);
  if (!(await stat(source)).isFile()) throw new GateError('INVALID_SOURCE', 'Selected source is not a file.');
  const policyRaw = await readFile(policyPath, 'utf8');
  let policy;
  try { policy = JSON.parse(policyRaw); } catch (e) { throw new GateError('INVALID_POLICY_JSON', `Policy is not valid JSON: ${e.message}`); }

  const work = await mkdtemp(path.join(tmpdir(), 'compact-privacy-gate-'));
  const output = path.join(work, 'compiled');
  try {
    const compile = await runCompiler(compactBin, source, output, path.dirname(source));
    const metadataPath = await findMetadata(output);
    const metadata = await parseMetadataFile(metadataPath);
    const ledger = extractLedger(metadata);
    for (const field of ['compiler-version', 'language-version', 'runtime-version']) {
      if (typeof metadata[field] !== 'string' || !metadata[field]) {
        throw new GateError('INVALID_METADATA', `Compiler metadata is missing a valid ${field}.`);
      }
    }
    const toolchain = {
      compiler: metadata['compiler-version'],
      language: metadata['language-version'],
      runtime: metadata['runtime-version']
    };
    const changes = [
      ...compareLedger(ledger, policy),
      ...compareToolchain(toolchain, policy)
    ].sort((a, b) => a.name.localeCompare(b.name));
    return {
      result: changes.length ? 'BLOCKED' : 'PASS',
      source: path.relative(await realpath(root), source),
      policy: path.relative(await realpath(root), policyPath),
      sourceSha256: sha256(await readFile(source)),
      metadataSha256: sha256(await readFile(metadataPath)),
      metadataFile: path.relative(output, metadataPath),
      toolchain,
      ledger, changes,
      compilerOutput: (compile.stdout + compile.stderr).trim().slice(-12000),
      explanation: changes.length ? `${changes.length} public-ledger schema change(s) require policy review.` : 'The compiled public ledger matches the reviewed policy.'
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
