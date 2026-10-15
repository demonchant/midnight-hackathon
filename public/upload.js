const form = document.querySelector('#inspect-form');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.readAsText(file);
});
const safe = value => { const node = document.createElement('span'); node.textContent = value; return node; };

async function inspect(sourceName, sourceText, policyName, policyText) {
  submit.disabled = true;
  report.hidden = true;
  status.textContent = 'Compiling temporarily with Compact and comparing generated metadata…';
  try {
    const response = await fetch('/api/inspect', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceName, sourceText, policyName, policyText })
    });
    const result = await response.json();
    report.replaceChildren();
    report.className = result.result === 'PASS' ? 'pass' : result.result === 'BLOCKED' ? 'blocked' : 'error';
    const title = document.createElement('h2');
    title.textContent = result.result === 'PASS' ? 'Schema matches policy' : result.result === 'BLOCKED' ? 'Schema or toolchain differs' : result.code === 'COMPILATION_FAILED' ? 'Compilation failed; policy was not evaluated' : 'Inspection could not be completed';
    report.append(title);
    const explanation = document.createElement('p'); explanation.textContent = result.explanation || result.message || 'No additional details.'; report.append(explanation);
    if (result.toolchain) { const versions = document.createElement('p'); versions.className = 'report-meta'; versions.textContent = `Compiler ${result.toolchain.compiler} · language ${result.toolchain.language} · runtime ${result.toolchain.runtime}`; report.append(versions); }
    if (result.ledger) { const ledger = document.createElement('pre'); ledger.textContent = JSON.stringify({ ledger: result.ledger, changes: result.changes, sourceSha256: result.sourceSha256, metadataSha256: result.metadataSha256 }, null, 2); report.append(ledger); }
    if (result.details) { const details = document.createElement('pre'); details.setAttribute('aria-label', 'Compact compiler output'); details.textContent = result.details; report.append(details); }
    if (result.limitations) { const note = document.createElement('p'); note.textContent = result.limitations.join(' '); report.append(note); }
    report.hidden = false;
    status.textContent = '';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Upload failed.';
  } finally { submit.disabled = false; }
}

async function runSample(kind) {
  const event = kind.startsWith('event-');
  const blocked = kind.endsWith('block');
  const sourcePath = event
    ? (blocked ? 'private-event-checkin-mutated.compact' : 'private-event-checkin.compact')
    : (blocked ? 'ledger-schema-smoke-mutated.compact' : 'ledger-schema-smoke.compact');
  const policyPath = event ? 'private-event-checkin.policy.json' : 'ledger-schema-smoke.policy.json';
  const [sourceResponse, policyResponse] = await Promise.all([
    fetch(`/samples/${sourcePath}`), fetch(`/samples/${policyPath}`)
  ]);
  if (!sourceResponse.ok || !policyResponse.ok) throw new Error('Could not load the built-in example. Refresh after the latest app deploy, then try again.');
  await inspect(sourcePath, await sourceResponse.text(), policyPath, await policyResponse.text());
}

for (const [id, kind] of [
  ['#sample-pass', 'pass'], ['#sample-block', 'block'],
  ['#sample-event-pass', 'event-pass'], ['#sample-event-block', 'event-block']
]) {
  document.querySelector(id).addEventListener('click', async () => {
    status.textContent = 'Loading the built-in Compact sample…';
    try { await runSample(kind); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not run the built-in sample.'; }
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  report.hidden = true;
  const source = form.elements.source.files[0];
  const policy = form.elements.policy.files[0];
  if (!source || !policy) return;
  if (!source.name.toLowerCase().endsWith('.compact')) { status.textContent = 'Choose a .compact source file.'; return; }
  if (!policy.name.toLowerCase().endsWith('.json')) { status.textContent = 'Choose a .json policy file.'; return; }
  if (source.size > 256 * 1024 || policy.size > 64 * 1024) { status.textContent = 'Source limit is 256 KiB; policy limit is 64 KiB.'; return; }

  await inspect(source.name, await readFile(source), policy.name, await readFile(policy));
});
