const status = document.querySelector('#compiler-status');
const statusNote = status?.closest('.trust-note');

async function showCompilerReadiness() {
  if (!status) return;
  try {
    const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const result = await response.json();
    if (response.ok && result.ready) {
      status.textContent = `Live compiler ready · Compact ${result.compiler}`;
      statusNote?.classList.add('is-ready');
      return;
    }
    status.textContent = 'Live compiler temporarily unavailable';
    statusNote?.classList.add('is-error');
  } catch {
    status.textContent = 'Live compiler status could not be reached';
    statusNote?.classList.add('is-error');
  }
}

showCompilerReadiness();
