import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentTask } from '../agents/types.js';
import { readJsonFile } from './json-store.js';

interface RiskPolicies {
  agentesPorNivelDefault: Record<string, string>;
  niveles: { codigo: string; aprobacion: string }[];
}

/** Comprueba aprobación por nivel de riesgo antes de ejecutar tarea. */
export class RiskGate {
  constructor(
    private readonly codificaDir: string,
    private readonly riskApprovals: Record<string, boolean> = {}
  ) {}

  canExecute(task: AgentTask): { allowed: boolean; reason?: string } {
    const policies = readJsonFile<RiskPolicies>(
      join(this.codificaDir, 'config', 'risk-policies.json'),
      { agentesPorNivelDefault: {}, niveles: [] }
    );

    const level = task.riskLevel;
    if (level === 'bajo') return { allowed: true };

    if (level === 'alto') {
      const key = `alto:${task.agentRole}`;
      if (this.riskApprovals[key] || this.riskApprovals['alto:all']) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Tarea ${task.agentRole} requiere aprobación explícita (riesgo alto)`,
      };
    }

    // medio — permitido si no hay bloqueo explícito
    if (this.riskApprovals[`block:${task.id}`]) {
      return { allowed: false, reason: 'Tarea bloqueada por usuario' };
    }

    void policies;
    return { allowed: true };
  }
}

/** Prepara cwd con worktree o subcarpeta aislada. */
export class WorktreeManager {
  prepareTaskCwd(task: AgentTask, proyectoRoot: string): string {
    if (!task.worktreeBranch) return task.cwd;

    const worktreeBase = join(proyectoRoot, '.worktrees', task.agentRole);
    if (!existsSync(worktreeBase)) {
      mkdirSync(worktreeBase, { recursive: true });
    }
    return worktreeBase;
  }
}
