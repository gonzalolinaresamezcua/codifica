import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AGENT_REGISTRY } from '../agents/registry.js';
import type { AgentRole, AgentTask, ProfessionalPlan } from '../agents/types.js';
import { buildFullTaskPrompt } from '../prompts/loader.js';

/**
 * Descompone un Plan Profesional aprobado en tareas por agente Nivel 1-2.
 */
export class TaskDecomposer {
  constructor(private readonly codificaDir: string) {}

  decompose(plan: ProfessionalPlan): AgentTask[] {
    const tasks: AgentTask[] = [];
    const projectRoot = plan.projectPath;

    tasks.push(this.createTask(plan, 'planner', 1, projectRoot, 'bajo', []));

    const level2Roles: AgentRole[] = [
      'frontend',
      'backend',
      'database',
      'auth-security',
      'integration',
    ];

    const plannerTaskId = tasks[0]!.id;

    for (const role of level2Roles) {
      const subdir =
        role === 'backend' ? 'backend' : role === 'frontend' ? 'frontend' : '.';
      tasks.push(
        this.createTask(
          plan,
          role,
          2,
          join(projectRoot, subdir === '.' ? '' : subdir),
          'medio',
          [plannerTaskId]
        )
      );
    }

    const implIds = tasks.filter((t) => t.level === 2).map((t) => t.id);

    tasks.push(
      this.createTask(plan, 'deploy', 2, projectRoot, 'alto', implIds),
      this.createTask(plan, 'qa-testing', 2, projectRoot, 'medio', implIds),
      this.createTask(plan, 'debug-supervisor', 2, projectRoot, 'bajo', implIds)
    );

    return tasks;
  }

  private createTask(
    plan: ProfessionalPlan,
    role: AgentRole,
    level: 1 | 2,
    cwd: string,
    riskLevel: 'bajo' | 'medio' | 'alto',
    dependsOn: string[]
  ): AgentTask {
    const def = AGENT_REGISTRY.find((a) => a.id === role);
    const contextPrompt = this.buildContextPrompt(plan, role, def?.description ?? role);
    const prompt = buildFullTaskPrompt(this.codificaDir, role, contextPrompt);

    return {
      id: randomUUID(),
      planId: plan.id,
      agentRole: role,
      level,
      prompt,
      cwd,
      worktreeBranch: level === 2 ? `codifica/${role}` : null,
      riskLevel,
      dependsOn,
      status: 'queued',
    };
  }

  private buildContextPrompt(plan: ProfessionalPlan, role: AgentRole, description: string): string {
    return [
      `Proyecto: ${plan.projectSlug}`,
      `Rol: ${role} — ${description}`,
      '',
      'Prompt original:',
      plan.userPrompt,
      '',
      'Objetivos:',
      ...plan.objectives.map((o) => `- ${o}`),
      '',
      'Stack:',
      ...plan.technologies.map((t) => `- ${t}`),
      '',
      'Arquitectura:',
      plan.architecture,
      '',
      'REGLAS:',
      '- Código SOLO en /proyecto/ (cwd asignado)',
      '- Datos JSON de la app en /datos/app/',
      '- NO modifiques /codifica',
    ].join('\n');
  }
}
