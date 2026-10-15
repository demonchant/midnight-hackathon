const connection = document.querySelector('#connection');
const form = document.querySelector('#inspect-form');
const notice = document.querySelector('#notice');
const result = document.querySelector('#result');
const button = document.querySelector('#submit');
const localButton = document.querySelector('#run-local-contract');
const contractNotice = document.querySelector('#contract-notice');
const contractReport = document.querySelector('#contract-report');
let lastReport = null;

function safeText(tag, text, className) {
  const el = document.createElement(tag); el.textContent = text;
  if (className) el.className = className;
  return el;
}

async function loadStatus() {
  try {
    const status = await fetch('/api/status').then(r => r.json());
    connection.innerHTML = '';
    const dot = document.createElement('i'); connection.append(dot, document.createTextNode(status.configured ? 'Local project configured' : 'Project root required'));
    connection.classList.toggle('ready', status.configured);
    notice.textContent = status.configured
      ? `Compiler command: ${status.compiler}. Source and policy paths are confined to the configured local project root.`
      : 'Blocked: set CPG_PROJECT_ROOT and restart this local server. No sample contract or policy is loaded.';
  } catch { notice.textContent = 'Could not read local server status.'; }
}

function render(data) {
  lastReport = data;
  result.hidden = false; result.replaceChildren();
  const passed = data.result === 'PASS';
  const head = document.createElement('div'); head.className = `result-head ${passed ? 'pass' : 'fail'}`;
  head.append(safeText('span', passed ? 'POLICY MATCH' : data.result === 'BLOCKED' ? 'POLICY REVIEW REQUIRED' : 'INSPECTION ERROR', 'eyebrow'));
  head.append(safeText('h2', passed ? 'Compiled schema matches policy.' : data.message || data.explanation || 'The schema differs from policy.'));
  result.append(head);
  if (data.ledger) {
    const meta = document.createElement('p'); meta.className = 'provenance';
    const versions = data.toolchain ? `Compact ${data.toolchain.compiler} · language ${data.toolchain.language} · runtime ${data.toolchain.runtime} · ` : '';
    meta.textContent = `${versions}Source SHA-256 ${data.sourceSha256} · Metadata SHA-256 ${data.metadataSha256} · ${data.metadataFile}`; result.append(meta);
    const title = safeText('h3', 'Public ledger fields'); result.append(title);
    const table = document.createElement('div'); table.className = 'table';
    const labels = ['Index', 'Field', 'Exported', 'Storage', 'Type'];
    const header = document.createElement('div'); header.className = 'row table-head'; labels.forEach(x => header.append(safeText('span', x))); table.append(header);
    data.ledger.forEach(field => {
      const row = document.createElement('div'); row.className = 'row';
      [String(field.index), field.name, String(field.exported), field.storage, JSON.stringify(field.type)].forEach(x => row.append(safeText('span', x)));
      table.append(row);
    });
    if (!data.ledger.length) table.append(safeText('p', 'Compiler reported no ledger fields.', 'empty'));
    result.append(table);
  }
  if (data.changes?.length) {
    result.append(safeText('h3', 'Changes requiring review'));
    const list = document.createElement('ul'); list.className = 'changes';
    for (const change of data.changes) {
      let detail = '';
      if (change.kind === 'toolchain-changed') detail = ` · approved ${JSON.stringify(change.expected)} → compiled ${JSON.stringify(change.actual)}`;
      else if (change.kind === 'changed') detail = ` · approved ${JSON.stringify(change.expected)} → compiled ${JSON.stringify(change.actual)}`;
      else if (change.kind === 'unapproved') detail = ` · compiled ${JSON.stringify(change.actual)}`;
      else if (change.kind === 'removed') detail = ` · approved ${JSON.stringify(change.expected)}; absent from compiled contract`;
      list.append(safeText('li', `${change.kind.toUpperCase()}: ${change.name}${detail}`));
    }
    result.append(list);
  }
  const download = document.createElement('button'); download.type = 'button'; download.className = 'download';
  download.textContent = 'Download this inspection report';
  download.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `compact-privacy-gate-${data.result.toLowerCase()}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  });
  result.append(download);
}

form.addEventListener('submit', async event => {
  event.preventDefault(); result.hidden = true; button.disabled = true; button.firstElementChild.textContent = 'Compiling…';
  notice.textContent = 'Running the configured Compact compiler and validating its output…';
  try {
    const response = await fetch('/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: form.source.value.trim(), policy: form.policy.value.trim() }) });
    const data = await response.json(); render(data);
    notice.textContent = response.ok ? 'Inspection completed from actual compiler output.' : 'Inspection did not pass. Review the result and fix the reported issue.';
  } catch (error) { render({ result: 'ERROR', message: error.message }); notice.textContent = 'Request failed; no successful result was recorded.'; }
  finally { button.disabled = false; button.firstElementChild.textContent = 'Compile & compare'; }
});

localButton.addEventListener('click', async () => {
  localButton.disabled = true;
  localButton.firstElementChild.textContent = 'Compiling, proving, and waiting for indexer…';
  contractReport.hidden = true;
  contractNotice.textContent = 'Running only against the local undeployed network. Waiting for finalized transaction and independent indexer read-back…';
  try {
    const response = await fetch('/api/local-contract/run', { method: 'POST' });
    const data = await response.json();
    contractReport.hidden = false;
    contractReport.dataset.result = data.result || 'ERROR';
    contractReport.textContent = JSON.stringify(data, null, 2);
    contractNotice.textContent = data.result === 'VERIFIED'
      ? 'Local devnet transaction finalized and public state independently read back. See actual evidence path below.'
      : `Local contract run ${data.result || 'failed'} at ${data.stage || 'execution'}; no successful result was recorded.`;
  } catch (error) {
    contractReport.hidden = false;
    contractReport.dataset.result = 'ERROR';
    contractReport.textContent = error.message;
    contractNotice.textContent = 'Request failed. No successful local transaction or read-back was recorded.';
  } finally {
    localButton.disabled = false;
    localButton.firstElementChild.textContent = 'Deploy and verify locally';
  }
});
loadStatus();
