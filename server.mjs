import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { inspect } from './inspect.mjs';
import { GateError } from './core.mjs';
import { loadConfig } from './config.mjs';

await loadConfig();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.CPG_PROJECT_ROOT && path.resolve(process.env.CPG_PROJECT_ROOT);
const host = process.env.CPG_HOST || '127.0.0.1';
const port = Number(process.env.CPG_PORT || 4178);
if (host !== '127.0.0.1') throw new Error('This app includes a local-only contract runner and must bind to 127.0.0.1.');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CPG_PORT must be a valid TCP port.');
let inspectionInProgress = false;

function runLocalScript(script, timeoutMs = 15 * 60 * 1000) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script], {
      cwd: here,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const append = (current, chunk) => (current + chunk).slice(-24000);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, 5000).unref();
    }, timeoutMs);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    child.on('error', error => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      resolve({ code: 2, timedOut, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on('close', code => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      resolve({ code: timedOut ? 124 : code ?? 2, timedOut, stdout, stderr });
    });
  });
}

function rejectCrossOrigin(req, res) {
  const expectedHost = `${host}:${port}`;
  const expectedOrigin = `http://${expectedHost}`;
  if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== expectedOrigin)) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result: 'ERROR', code: 'LOCAL_ORIGIN_REJECTED', message: 'This local action accepts requests only from its 127.0.0.1 origin.' }));
    return true;
  }
  return false;
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(path.join(here, 'public/landing.html'))); return;
  }
  if (req.method === 'GET' && (req.url === '/app' || req.url === '/app/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(path.join(here, 'public/index.html'))); return;
  }
  if (req.method === 'GET' && req.url === '/app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(await readFile(path.join(here, 'public/app.js'))); return;
  }
  if (req.method === 'GET' && req.url === '/styles.css') {
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); res.end(await readFile(path.join(here, 'public/styles.css'))); return;
  }
  if (req.method === 'GET' && req.url === '/landing.css') {
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); res.end(await readFile(path.join(here, 'public/landing.css'))); return;
  }
  if (req.method === 'GET' && req.url === '/privacy-gate-hero.png') {
    try {
      const image = await readFile(path.join(here, 'public/privacy-gate-hero.png'));
      res.writeHead(200, { 'content-type': 'image/png' }); res.end(image);
    } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Hero image not added yet'); }
    return;
  }
  if (req.method === 'GET' && req.url === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ configured: !!root, root: root || null, compiler: process.env.COMPACT_BIN || 'compact', ready: !!root })); return;
  }
  if (req.method === 'POST' && req.url === '/api/inspect') {
    if (rejectCrossOrigin(req, res)) return;
    if (!root) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: 'ROOT_NOT_CONFIGURED', message: 'Set CPG_PROJECT_ROOT and restart the local server.' })); return; }
    let raw = '', acquired = false;
    try {
      for await (const chunk of req) { raw += chunk; if (raw.length > 8192) { res.writeHead(413); res.end(); return; } }
      const body = JSON.parse(raw);
      if (!body || typeof body.source !== 'string' || typeof body.policy !== 'string') throw new GateError('INVALID_REQUEST', 'Provide source and policy relative paths.');
      if (inspectionInProgress) { res.writeHead(409, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: 'ERROR', code: 'INSPECTION_BUSY', message: 'Another Compact inspection is already running. Wait for it to finish.' })); return; }
      inspectionInProgress = true; acquired = true;
      const result = await inspect({ root, sourceRelative: body.source, policyRelative: body.policy, compactBin: process.env.COMPACT_BIN || 'compact' });
      res.writeHead(result.result === 'PASS' ? 200 : 409, { 'content-type': 'application/json' }); res.end(JSON.stringify(result));
    } catch (e) {
      const status = e.code === 'COMPILER_UNAVAILABLE' ? 503 : e.code === 'COMPILE_TIMEOUT' ? 504 : e.code === 'COMPILE_FAILED' ? 502 : 400;
      res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: 'ERROR', code: e.code || 'INTERNAL_ERROR', message: e.message }));
    } finally { if (acquired) inspectionInProgress = false; }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/local-contract/run') {
    if (rejectCrossOrigin(req, res)) return;
    if (!root) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: 'BLOCKED', code: 'ROOT_NOT_CONFIGURED', message: 'Set CPG_PROJECT_ROOT and restart this local server.' })); return; }
    if (inspectionInProgress) { res.writeHead(409, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: 'ERROR', code: 'INSPECTION_BUSY', message: 'Another compiler or local-chain operation is already running.' })); return; }
    inspectionInProgress = true;
    try {
      const compile = await runLocalScript(path.join(here, 'scripts', 'compile-private-contract.mjs'));
      if (compile.code !== 0) {
        const report = { result: 'ERROR', stage: 'compile', exitCode: compile.code, timedOut: compile.timedOut, output: compile.stderr || compile.stdout || 'Compact compilation failed. See the local server terminal.' };
        res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify(report)); return;
      }
      const execution = await runLocalScript(path.join(here, 'scripts', 'deploy-private-counter-local.mjs'));
      let report;
      const resultLine = execution.stdout.split(/\r?\n/).filter(line => line.startsWith('CPG_LOCAL_RESULT_JSON=')).at(-1);
      try { report = JSON.parse(resultLine.slice('CPG_LOCAL_RESULT_JSON='.length)); }
      catch {
        report = { status: 'FAILED', error: 'Local runner did not return its structured evidence report.' };
      }
      const verified = execution.code === 0 && report.status === 'VERIFIED';
      res.writeHead(verified ? 200 : 502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ result: verified ? 'VERIFIED' : 'FAILED', exitCode: execution.code, timedOut: execution.timedOut, ...report }));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ result: 'ERROR', message: error instanceof Error ? error.message : String(error) }));
    } finally { inspectionInProgress = false; }
    return;
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(port, host, () => console.log(`Compact Privacy Change Gate listening at http://${host}:${port}`));
