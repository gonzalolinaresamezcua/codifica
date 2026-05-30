const promptEl = document.getElementById('prompt');
const submitBtn = document.getElementById('submitBtn');
const planSummary = document.getElementById('planSummary');
const logsEl = document.getElementById('logs');
const maxParallelEl = document.getElementById('maxParallel');
const approveAltoEl = document.getElementById('approveAlto');
const overnightEl = document.getElementById('overnight');

let currentPlanId = null;

function log(msg, cls = '') {
  const line = document.createElement('div');
  line.className = `log-line ${cls}`;
  line.textContent = msg;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight;
}

async function bootstrap() {
  const res = await fetch('/api/bootstrap');
  const data = await res.json();
  log(`Bootstrap OK — datos: ${data.paths?.datosRoot ?? '—'}`);
}

async function loadDefaultPrompt() {
  const res = await fetch('/api/default-prompt');
  const data = await res.json();
  if (promptEl && data.prompt) {
    promptEl.value = data.prompt;
  }
}

function renderPlan(plan) {
  if (!planSummary) return;
  planSummary.classList.remove('hidden');
  planSummary.innerHTML = `
    <strong>Plan ${plan.id.slice(0, 8)}…</strong>
    <p>Tokens: ~${plan.tokenEstimate.total} ($${plan.tokenEstimate.costUsd})</p>
    <p>Stack: ${plan.technologies.join(', ')}</p>
    <button type="button" id="executeBtn">Ejecutar agentes</button>
  `;
  document.getElementById('executeBtn')?.addEventListener('click', () => executePlan(plan.id));
}

async function createPlan() {
  const prompt = promptEl?.value?.trim();
  if (!prompt) return;

  submitBtn.disabled = true;
  logsEl.innerHTML = '';
  log('Generando plan…');

  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const plan = await res.json();
  if (!res.ok) {
    log(`Error: ${plan.error ?? res.statusText}`, 'err');
    submitBtn.disabled = false;
    return;
  }

  currentPlanId = plan.id;
  log(`Plan creado: ${plan.id}`);
  renderPlan(plan);
  submitBtn.disabled = false;
}

async function executePlan(planId) {
  log('Ejecutando agentes…');
  submitBtn.disabled = true;

  const riskApprovals = approveAltoEl?.checked ? { 'alto:all': true } : {};

  const res = await fetch(`/api/plans/${planId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maxParallel: Number(maxParallelEl?.value ?? 3),
      overnight: overnightEl?.checked ?? false,
      riskApprovals,
    }),
  });

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) {
    log('Error: no stream');
    submitBtn.disabled = false;
    return;
  }

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim();
      if (!line) continue;
      try {
        const ev = JSON.parse(line);
        log(`[${ev.agentRole}] ${ev.action}: ${String(ev.detail).slice(0, 100)}`);
      } catch {
        /* ignore */
      }
    }
  }

  log('Ejecución terminada.');
  submitBtn.disabled = false;
}

submitBtn?.addEventListener('click', createPlan);
promptEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    createPlan();
  }
});

bootstrap().then(loadDefaultPrompt);
