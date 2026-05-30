import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProfessionalPlan } from '../agents/types.js';

/** Actualiza index.html raíz y README tras ejecución completada. */
export function updateRootAfterExecution(
  mainRoot: string,
  codificaDir: string,
  plan: ProfessionalPlan
): void {
  const rootIndex = join(mainRoot, 'index.html');
  const template = join(codificaDir, 'templates', 'root-index.html');
  if (existsSync(template)) {
    let html = readFileSync(template, 'utf8');
    html = html.replace(
      '<title>Proyecto Codifica</title>',
      `<title>${plan.projectSlug} — Codifica</title>`
    );
    writeFileSync(rootIndex, html, 'utf8');
  }

  const readme = join(mainRoot, 'README.md');
  const extra = `\n\n## Último build\n\n- Plan: ${plan.id}\n- Proyecto: ${plan.projectSlug}\n- Estado: ${plan.status}\n- Completado: ${plan.completedAt ?? '—'}\n`;
  if (existsSync(readme)) {
    appendFileSync(readme, extra, 'utf8');
  }
}

/** Genera hooks.json de riesgo en /proyecto/.cursor/ */
export function writeProjectHooks(proyectoRoot: string, codificaDir: string): void {
  const hooksDir = join(proyectoRoot, '.cursor');
  const policiesPath = join(codificaDir, 'config', 'risk-policies.json');
  if (!existsSync(policiesPath)) return;

  const hooks = {
    version: 1,
    hooks: {
      preToolUse: [{ command: 'echo Codifica risk gate active' }],
    },
    meta: { source: 'codifica', policies: policiesPath },
  };

  writeFileSync(join(hooksDir, 'hooks.json'), JSON.stringify(hooks, null, 2), 'utf8');
}
