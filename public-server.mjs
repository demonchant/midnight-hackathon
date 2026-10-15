import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilerReadiness, inspectUploaded } from './public-inspect.mjs';
import { GateError } from './core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.CPG_PUBLIC_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.CPG_PUBLIC_PORT || 8080);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid public server port.');
}

let active = false;
const recentJobsByClient = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_JOBS_PER_WINDOW = 8;
const MAX_GLOBAL_JOBS_PER_WINDOW = 32;
const MAX_CLIENT_BUCKETS = 4096;
const recentGlobalJobs = [];
// JSON escaping can expand a source/policy close to the decoded per-file
// limits, so leave bounded headroom while keeping the request finite.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function clientAddress(req) {
  if (process.env.CPG_TRUST_PROXY === '1' || process.env.CPG_TRUST_PROXY === 'render') {
    const forwardedChain = String(req.headers['x-forwarded-for'] || '').split(',').map(value => value.trim());
    // Render documents the visitor address as the first X-Forwarded-For IP.
    // The Caddy deployment overwrites the header with exactly one trusted IP.
    const forwarded = process.env.CPG_TRUST_PROXY === 'render' ? forwardedChain[0] : forwardedChain.at(-1);
    if (isIP(forwarded)) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;

  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);

    if (bytes > MAX_BODY_BYTES) {
      throw new GateError('REQUEST_TOO_LARGE', 'The request exceeds the upload limit.');
    }

    chunks.push(Buffer.from(chunk));
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GateError('INVALID_JSON', 'Request body must be valid JSON.');
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(here, 'public/landing-public.html')));
    return;
  }

  if (req.method === 'GET' && ['/app', '/app/'].includes(req.url)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(here, 'public/upload.html')));
    return;
  }

  const staticFiles = {
    '/landing.css': ['public/landing.css', 'text/css; charset=utf-8'],
    '/upload.js': ['public/upload.js', 'text/javascript; charset=utf-8'],
    '/upload.css': ['public/upload.css', 'text/css; charset=utf-8'],
    '/privacy-gate-hero.png': ['public/privacy-gate-hero.png', 'image/png'],
    '/samples/ledger-schema-smoke.compact': ['examples/ledger-schema-smoke.compact', 'text/plain; charset=utf-8'],
    '/samples/ledger-schema-smoke.policy.json': ['examples/ledger-schema-smoke.policy.json', 'application/json; charset=utf-8'],
    '/samples/ledger-schema-smoke-mutated.compact': ['examples/ledger-schema-smoke-mutated.compact', 'text/plain; charset=utf-8']
  };

  if (req.method === 'GET' && staticFiles[req.url]) {
    const [file, type] = staticFiles[req.url];
    try {
      const content = await readFile(path.join(here, file));
      res.writeHead(200, { 'content-type': type });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    const compiler = await compilerReadiness();
    json(res, compiler.ready ? 200 : 503, {
      ready: compiler.ready,
      mode: 'public-upload',
      compilerExecution: compiler.execution || 'disposable-container',
      compiler: compiler.compiler,
      compilerImage: compiler.image,
      ...(compiler.code ? { code: compiler.code } : {}),
      maxSourceBytes: 256 * 1024,
      maxPolicyBytes: 64 * 1024,
      maxInspectionsPerClientPerWindow: MAX_JOBS_PER_WINDOW,
      maxInspectionsGlobalPerWindow: MAX_GLOBAL_JOBS_PER_WINDOW,
      rateWindowSeconds: WINDOW_MS / 1000,
      maxConcurrentInspections: 1
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/inspect') {
    // Reject cross-origin browser submissions. There are no cookies or
    // browser credentials in this API.
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          json(res, 403, { result: 'ERROR', code: 'ORIGIN_REJECTED', message: 'Cross origin requests are not accepted.' });
          return;
        }
      } catch {
        json(res, 403, { result: 'ERROR', code: 'ORIGIN_REJECTED', message: 'Invalid request origin.' });
        return;
      }
    }

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    for (const [address, timestamps] of recentJobsByClient) {
      while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
      if (timestamps.length === 0) recentJobsByClient.delete(address);
    }
    while (recentGlobalJobs.length && recentGlobalJobs[0] < cutoff) recentGlobalJobs.shift();
    const address = clientAddress(req);
    const recentJobs = recentJobsByClient.get(address) || [];

    if (recentJobs.length >= MAX_JOBS_PER_WINDOW) {
      json(res, 429, { result: 'ERROR', code: 'RATE_LIMITED', message: 'The public inspection limit has been reached. Try again later.' });
      return;
    }
    if (recentGlobalJobs.length >= MAX_GLOBAL_JOBS_PER_WINDOW) {
      json(res, 429, { result: 'ERROR', code: 'GLOBAL_RATE_LIMITED', message: 'The public inspection service has reached its temporary capacity. Try again later.' });
      return;
    }
    if (!recentJobsByClient.has(address) && recentJobsByClient.size >= MAX_CLIENT_BUCKETS) {
      json(res, 429, { result: 'ERROR', code: 'RATE_LIMIT_CAPACITY', message: 'The public inspection service is temporarily at capacity. Try again later.' });
      return;
    }

    if (active) {
      json(res, 429, { result: 'ERROR', code: 'BUSY', message: 'An inspection is already running. Please try again shortly.' });
      return;
    }

    if (!String(req.headers['content-type'] || '').includes('application/json')) {
      json(res, 415, { result: 'ERROR', code: 'UNSUPPORTED_CONTENT_TYPE', message: 'Send uploads as JSON.' });
      return;
    }

    active = true;
    recentJobs.push(now);
    recentJobsByClient.set(address, recentJobs);
    recentGlobalJobs.push(now);

    try {
      const body = await readJson(req);
      const report = await inspectUploaded({
        sourceText: body.sourceText,
        policyText: body.policyText,
        sourceName: body.sourceName,
        policyName: body.policyName
      });
      json(res, report.result === 'PASS' ? 200 : 409, report);
    } catch (error) {
      const known = error instanceof GateError;
      const code = known ? error.code : 'INTERNAL_ERROR';
      const message = known ? error.message : 'Inspection failed. Check the server logs.';
      const details = known && error.details ? error.details : undefined;

      const status =
        code === 'REQUEST_TOO_LARGE' || code === 'SOURCE_TOO_LARGE' || code === 'POLICY_TOO_LARGE' ? 413 :
        code === 'COMPILATION_FAILED' ? 422 :
        code === 'PROCESS_TIMEOUT' ? 504 :
        code === 'PROCESS_START_FAILED' || code === 'PROCESS_FAILED' ? 503 :
        code === 'BUSY' ? 429 :
        code.startsWith('INVALID') || code.endsWith('TOO_LARGE') ? 400 :
        500;

      json(res, status, { result: 'ERROR', code, message, ...(details ? { details } : {}) });
    } finally {
      active = false;
    }
    return;
  }

  // Deliberately no local-contract-run route.
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

server.listen(port, host, () => {
  console.log(`Compact Privacy Change Gate public server listening on ${host}:${port}`);
});
