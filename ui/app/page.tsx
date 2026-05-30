'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Plan {
  id: string;
  projectSlug: string;
  status: string;
  tokenEstimate: { total: number; costUsd: number };
}

export default function DashboardPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/default-prompt')
      .then((r) => r.json())
      .then((d) => setPrompt(d.prompt ?? ''));
    fetch('/api/plans')
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  async function createPlan() {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const plan = await res.json();
    setPlans((p) => [plan, ...p]);
    setLogs((l) => [...l, `Plan creado: ${plan.id}`]);
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Codifica Dashboard</h1>
        <Link href="http://localhost:3000/codifica/index.html" style={{ color: '#7dd3fc' }}>
          Orquestador clásico
        </Link>
      </header>

      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <span>Nueva Tarea</span>
        <span>Proyectos Activos</span>
        <span>Agentes</span>
        <span>Logs</span>
        <span>Trazabilidad</span>
      </nav>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid #333', borderRadius: 8, padding: 12 }}
      />
      <button type="button" onClick={createPlan} style={{ marginTop: 12, padding: '8px 16px' }}>
        Generar plan
      </button>

      <section style={{ marginTop: 24 }}>
        <h2>Proyectos / Planes</h2>
        <ul>
          {plans.map((p) => (
            <li key={p.id}>
              {p.projectSlug} — {p.status} — {p.tokenEstimate.total} tokens
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Logs</h2>
        <pre style={{ background: '#18181b', padding: 12, borderRadius: 8, fontSize: 12 }}>
          {logs.join('\n') || 'Sin eventos'}
        </pre>
      </section>
    </main>
  );
}
