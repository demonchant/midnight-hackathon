import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  compareLedger,
  compareToolchain,
  extractLedger,
  GateError,
  sha256,
  validatePolicy
} from './core.mjs';

const IMAGE = process.env.CPG_COMPILER_IMAGE || 'cpg-compact-compiler:0.31.1';
const DIRECT_MODE = process.env.CPG_COMPILER_MODE === 'direct';
const COMPACT_BIN = process.env.CPG_COMPACT_BIN || 'compact';
const configuredTimeout = process.env.CPG_COMPILE_TIMEOUT_MS;
const COMPILE_TIMEOUT_MS = configuredTimeout === undefined ? 180_000 : Number(configuredTimeout);
if (!Number.isInteger(COMPILE_TIMEOUT_MS) || COMPILE_TIMEOUT_MS < 1 || COMPILE_TIMEOUT_MS > 180_000) {
  throw new Error('CPG_COMPILE_TIMEOUT_MS must be an integer from 1 to 180000.');
}

export async function compilerReadiness() {
  if (DIRECT_MODE) {
    try {
      const probe = await run(COMPACT_BIN, ['compile', '--version'], 5000, null, 1024, true);
      const expected = process.env.CPG_COMPILER_VERSION || '0.31.1';
      // run() omits `code` on successful exits and includes it only for
      // allowed nonzero exits. Treat an absent code as the normal exit 0.
      if (probe.code === undefined && `${probe.stdout}\n${probe.stderr}`.includes(expected)) {
        return { ready: true, compiler: expected, image: `embedded-compact:${expected}`, execution: 'service-process' };
      }
      return { ready: false, compiler: expected, image: `embedded-compact:${expected}`, code: 'COMPILER_VERSION_MISMATCH', diagnostic: `Compiler version probe exited ${probe.code ?? 0}; output: ${(probe.stdout + probe.stderr).trim().slice(-500)}` };
    } catch (error) {
      return { ready: false, compiler: process.env.CPG_COMPILER_VERSION || '0.31.1', image: `embedded-compact:${process.env.CPG_COMPILER_VERSION || '0.31.1'}`, code: 'COMPILER_SERVICE_UNAVAILABLE', diagnostic: error.details || error.message };
    }
  }
  try {
    const probe = await run('docker', ['image', 'inspect', '--format={{.Id}}', IMAGE], 5000, null, 1024, true);
    if (probe.code === 0 && probe.stdout.trim()) {
      return { ready: true, compiler: process.env.CPG_COMPILER_VERSION || '0.31.1', image: IMAGE, execution: 'disposable-container' };
    }
    return { ready: false, compiler: process.env.CPG_COMPILER_VERSION || '0.31.1', image: IMAGE, code: 'COMPILER_IMAGE_UNAVAILABLE' };
  } catch {
    return { ready: false, compiler: process.env.CPG_COMPILER_VERSION || '0.31.1', image: IMAGE, code: 'COMPILER_SERVICE_UNAVAILABLE' };
  }
}

function run(command, args, timeoutMs = 30_000, stdinData = null, maxOutputBytes = 16_000, allowNonZero = false, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      windowsHide: true,
      stdio: [stdinData === null ? 'ignore' : 'pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const append = (old, chunk) => (old + chunk).slice(-maxOutputBytes);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 2000).unref();
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    if (stdinData !== null) child.stdin.end(stdinData);
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });

    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const failure = new GateError('PROCESS_START_FAILED', 'The isolated compiler service is unavailable.');
      failure.details = error.message;
      reject(failure);
    });

    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (timedOut) {
        reject(new GateError('PROCESS_TIMEOUT', 'The isolated compiler exceeded its time limit.'));
      } else if (code !== 0 && allowNonZero) {
        resolve({ stdout, stderr, code });
      } else if (code !== 0) {
        reject(new GateError('PROCESS_FAILED', 'The isolated compiler service could not complete the request.'));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function inspectUploaded({ sourceText, policyText, sourceName, policyName }) {
  if (typeof sourceText !== 'string' || typeof policyText !== 'string') {
    throw new GateError('INVALID_REQUEST', 'Upload a Compact source file and a JSON policy file.');
  }

  if (Buffer.byteLength(sourceText, 'utf8') > 256 * 1024) {
    throw new GateError('SOURCE_TOO_LARGE', 'Compact source must be at most 256 KiB.');
  }

  if (Buffer.byteLength(policyText, 'utf8') > 64 * 1024) {
    throw new GateError('POLICY_TOO_LARGE', 'Policy JSON must be at most 64 KiB.');
  }
  if (typeof sourceName !== 'string' || !sourceName.toLowerCase().endsWith('.compact') ||
      typeof policyName !== 'string' || !policyName.toLowerCase().endsWith('.json')) {
    throw new GateError('INVALID_UPLOAD_NAMES', 'Upload one .compact source file and one .json policy file.');
  }

  let policy;

  try {
    policy = JSON.parse(policyText);
    validatePolicy(policy);
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError('INVALID_POLICY_JSON', 'Policy must contain valid JSON.');
  }

  if (DIRECT_MODE) {
    const work = await mkdtemp(path.join(tmpdir(), 'cpg-public-compile-'));
    try {
      const sourcePath = path.join(work, 'contract.compact');
      const outputPath = path.join(work, 'compiled');
      await writeFile(sourcePath, sourceText, { encoding: 'utf8', mode: 0o600 });
      const compilation = await run('/bin/sh', [
        '-c',
        'ulimit -f 524288 && ulimit -v 1572864 && ulimit -t 170 && exec "$@"',
        'cpg-compiler', COMPACT_BIN, 'compile', sourcePath, outputPath
      ], COMPILE_TIMEOUT_MS, null, 16_000, true, {
        cwd: work,
        env: { ...process.env, HOME: work, TMPDIR: work, COMPACT_DIRECTORY: process.env.COMPACT_DIRECTORY || '/opt/compact-home/.compact' }
      });
      if (compilation.code !== undefined) {
        const details = (compilation.stderr || compilation.stdout).trim().slice(-12_000);
        const error = new GateError('COMPILATION_FAILED', 'Compact could not compile this source. No schema policy decision was made.');
        error.details = details || `Compiler exited with status ${compilation.code}.`;
        throw error;
      }
      const metadataBytes = await readFile(path.join(outputPath, 'compiler', 'contract-info.json'));
      if (metadataBytes.byteLength > 256 * 1024) throw new GateError('METADATA_TOO_LARGE', 'Compiler metadata exceeds the supported size limit.');
      const metadata = JSON.parse(metadataBytes.toString('utf8'));
      const ledger = extractLedger(metadata);
      for (const key of ['compiler-version', 'language-version', 'runtime-version']) {
        if (typeof metadata[key] !== 'string' || !metadata[key]) throw new GateError('INVALID_METADATA', `Missing compiler metadata field: ${key}.`);
      }
      const toolchain = { compiler: metadata['compiler-version'], language: metadata['language-version'], runtime: metadata['runtime-version'] };
      const changes = [...compareLedger(ledger, policy), ...compareToolchain(toolchain, policy)].sort((a, b) => a.name.localeCompare(b.name));
      return {
        result: changes.length ? 'BLOCKED' : 'PASS', sourceSha256: sha256(Buffer.from(sourceText, 'utf8')),
        metadataSha256: sha256(metadataBytes), toolchain, ledger, changes,
        explanation: changes.length ? `${changes.length} public ledger or toolchain change(s) require review.` : 'The compiler observed a public ledger schema matching the supplied policy.',
        limitations: [
          'This is a schema and toolchain comparison, not a contract security audit.',
          'A matching policy does not prove that a contract preserves privacy.',
          'The uploaded policy is supplied by the user and is not independently approved by this service.',
          'This Render demo runs Compact as an unprivileged subprocess in the service container; it does not use a per-upload Docker sandbox.',
          'The public service does not deploy contracts.'
        ]
      };
    } catch (error) {
      if (error instanceof GateError) throw error;
      if (error?.code === 'ENOENT') throw new GateError('INVALID_METADATA', 'Compact completed without producing contract-info.json.');
      throw error;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  let containerId = '';

  try {
    // A unique, disposable container per request. The workspace inside
    // the container is a size-limited tmpfs, not a host filesystem mount.
    const created = await run('docker', [
      'create',
      '--rm',
      '--network=none',
      '--memory=768m',
      '--memory-swap=768m',
      '--cpus=1',
      '--pids-limit=64',
      '--label=cpg.compact-gate=public-compiler',
      '--read-only',
      '--security-opt=no-new-privileges',
      '--cap-drop=ALL',
      '--user=65534:65534',
      '--tmpfs=/work:rw,nosuid,nodev,size=256m,uid=65534,gid=65534,mode=1777',
      '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=128m,uid=65534,gid=65534,mode=1777',
      '--env=HOME=/root',
      '--env=TMPDIR=/tmp',
      '--env=COMPACT_DIRECTORY=/opt/compact-home/.compact',
      '--workdir=/work',
      '--entrypoint=/bin/sleep',
      IMAGE,
      '240'
    ]);

    containerId = created.stdout.trim().split(/\s+/).at(-1);

    if (!containerId || !/^[a-f0-9]{12,64}$/i.test(containerId)) {
      throw new GateError('CONTAINER_CREATE_FAILED', 'Docker did not return a valid container ID.');
    }

    // Start first so Docker has mounted the bounded /work tmpfs before the
    // source is streamed into it. The host never executes uploaded code.
    await run('docker', ['start', containerId]);
    await run('docker', [
      'exec', '-i', containerId, '/bin/sh', '-c', 'cat > /work/contract.compact'
    ], 30_000, Buffer.from(sourceText, 'utf8'));
    const compilation = await run('docker', [
      'exec', containerId, 'compact', 'compile',
      '/work/contract.compact', '/work/compiled'
    ], COMPILE_TIMEOUT_MS, null, 16_000, true);
    if (compilation.code !== 0) {
      const output = (compilation.stderr || compilation.stdout).trim().slice(-12_000);
      const error = new GateError('COMPILATION_FAILED', 'Compact could not compile this source. No schema policy decision was made.');
      error.details = output || `Compiler exited with status ${compilation.code}.`;
      throw error;
    }

    // Read only the compiler's actual contract-info.json out of the
    // container. Generated keys and the source remain in bounded tmpfs.
    const metadataBytes = Buffer.from((await run('docker', [
      'exec', containerId, 'cat', '/work/compiled/compiler/contract-info.json'
    ], 30_000, null, 256 * 1024)).stdout, 'utf8');
    let metadata;
    try { metadata = JSON.parse(metadataBytes.toString('utf8')); }
    catch { throw new GateError('INVALID_METADATA_JSON', 'Compiler metadata is not valid JSON.'); }
    const ledger = extractLedger(metadata);

    for (const key of ['compiler-version', 'language-version', 'runtime-version']) {
      if (typeof metadata[key] !== 'string' || !metadata[key]) {
        throw new GateError('INVALID_METADATA', `Missing compiler metadata field: ${key}.`);
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
      sourceSha256: sha256(Buffer.from(sourceText, 'utf8')),
      metadataSha256: sha256(metadataBytes),
      toolchain,
      ledger,
      changes,
      explanation: changes.length
        ? `${changes.length} public ledger or toolchain change(s) require review.`
        : 'The compiler observed a public ledger schema matching the supplied policy.',
      limitations: [
        'This is a schema and toolchain comparison, not a contract security audit.',
        'A matching policy does not prove that a contract preserves privacy.',
        'The uploaded policy is supplied by the user and is not independently approved by this service.',
        'The public service does not deploy contracts.'
      ]
    };
  } finally {
    if (containerId) {
      try {
        await run('docker', ['rm', '-f', containerId], 10_000);
      } catch {
        // Retry once; do not silently claim a report if container cleanup failed.
        try {
          await run('docker', ['rm', '-f', containerId], 10_000);
        } catch {
          throw new GateError('CLEANUP_FAILED', 'The isolated compiler container could not be removed.');
        }
      }
    }
  }
}
