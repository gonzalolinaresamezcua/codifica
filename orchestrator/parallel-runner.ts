import type { AgentTask, ParallelRunOptions } from '../agents/types.js';
import { CursorAgentFactory } from '../sdk/cursor-agent-factory.js';
import type { RiskGate } from './worktree-manager.js';
import type { WorktreeManager } from './worktree-manager.js';

export interface ParallelRunnerDeps {
  factory: CursorAgentFactory;
  worktree: WorktreeManager;
  riskGate: RiskGate;
  proyectoRoot: string;
}

/**
 * Ejecuta agentes Cursor SDK en paralelo con límite de concurrencia.
 */
export class ParallelRunner {
  constructor(private readonly deps: ParallelRunnerDeps) {}

  setRiskGate(riskGate: RiskGate): void {
    this.deps.riskGate = riskGate;
  }

  async runAll(tasks: AgentTask[], opts: ParallelRunOptions): Promise<void> {
    const completed = new Set<string>();
    const queue = [...tasks];
    const running = new Set<Promise<void>>();

    const canRun = (task: AgentTask): boolean =>
      task.dependsOn.every((dep) => completed.has(dep));

    while (queue.length > 0 || running.size > 0) {
      const ready = queue.filter(canRun);
      for (const task of ready) {
        if (running.size >= opts.maxParallel) break;

        const idx = queue.indexOf(task);
        if (idx === -1) continue;
        queue.splice(idx, 1);

        const risk = this.deps.riskGate.canExecute(task);
        if (!risk.allowed) {
          task.status = 'failed';
          completed.add(task.id);
          opts.onEvent({
            id: '',
            timestamp: new Date().toISOString(),
            planId: task.planId,
            taskId: task.id,
            agentRole: task.agentRole,
            action: 'risk_blocked',
            detail: risk.reason ?? 'Bloqueado por política de riesgo',
            riskLevel: task.riskLevel,
            tokensUsed: null,
          });
          continue;
        }

        task.cwd = this.deps.worktree.prepareTaskCwd(task, this.deps.proyectoRoot);
        task.status = 'running';
        opts.onTaskStart?.(task);
        opts.onEvent({
          id: '',
          timestamp: new Date().toISOString(),
          planId: task.planId,
          taskId: task.id,
          agentRole: task.agentRole,
          action: 'task_started',
          detail: `Agente ${task.agentRole} en ${task.cwd}`,
          riskLevel: task.riskLevel,
          tokensUsed: null,
        });

        const promise = this.deps.factory
          .executeTask(task, (e) => opts.onEvent(e))
          .then((result) => {
            task.status = result.success ? 'completed' : 'failed';
            completed.add(task.id);
            opts.onTaskComplete?.(task);
            opts.onEvent({
              id: '',
              timestamp: new Date().toISOString(),
              planId: task.planId,
              taskId: task.id,
              agentRole: task.agentRole,
              action: result.success ? 'task_completed' : 'task_failed',
              detail: result.summary,
              riskLevel: task.riskLevel,
              tokensUsed: result.tokensUsed,
            });
          })
          .catch((err: Error) => {
            task.status = 'failed';
            completed.add(task.id);
            opts.onEvent({
              id: '',
              timestamp: new Date().toISOString(),
              planId: task.planId,
              taskId: task.id,
              agentRole: task.agentRole,
              action: 'task_failed',
              detail: err.message,
              riskLevel: task.riskLevel,
              tokensUsed: null,
            });
          })
          .finally(() => {
            running.delete(promise);
          });

        running.add(promise);
      }

      if (running.size > 0) {
        await Promise.race(running);
      } else if (queue.length > 0) {
        const blocked = queue.shift()!;
        blocked.status = 'failed';
        completed.add(blocked.id);
        opts.onEvent({
          id: '',
          timestamp: new Date().toISOString(),
          planId: blocked.planId,
          taskId: blocked.id,
          agentRole: blocked.agentRole,
          action: 'task_failed',
          detail: 'Dependencias no satisfechas',
          riskLevel: blocked.riskLevel,
          tokensUsed: null,
        });
      }
    }
  }
}
