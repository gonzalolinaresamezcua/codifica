import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Agent } from '@cursor/sdk';
import type { ProfessionalPlan, SchedulePhase, TokenEstimate } from '../agents/types.js';
import { readDefaultPrompt } from './bootstrap.js';
import { extractJsonFromText, parsePlanFromLlm } from './plan-schema.js';

/** Genera slug URL-safe desde el prompt del usuario. */
export function slugifyPrompt(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `proyecto-${Date.now()}`;
}

export interface PlanBuilderOptions {
  codificaDir: string;
  apiKey?: string;
  modelId?: string;
}

/**
 * Construye el Plan Profesional — LLM vía @cursor/sdk con fallback heurístico.
 */
export class PlanBuilder {
  constructor(private readonly options: PlanBuilderOptions) {}

  async build(userPrompt: string, proyectoRoot: string): Promise<ProfessionalPlan> {
    const heuristic = this.buildHeuristic(userPrompt, proyectoRoot);

    if (!this.options.apiKey) {
      return heuristic;
    }

    try {
      const llmPlan = await this.buildWithSdk(userPrompt, proyectoRoot, heuristic.id);
      return llmPlan;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      heuristic.risks.push(`Fallback heurístico: plan SDK falló (${msg})`);
      return heuristic;
    }
  }

  private async buildWithSdk(
    userPrompt: string,
    proyectoRoot: string,
    planId: string
  ): Promise<ProfessionalPlan> {
    const slug = slugifyPrompt(userPrompt);
    const projectPath = resolve(proyectoRoot);

    const planningPrompt = [
      'Genera un Plan Profesional en JSON válido (sin markdown) con este schema:',
      '{ id, userPrompt, objectives[], technologies[], architecture, risks[], schedule[{phase,durationHours,agents[]}], tokenEstimate{input,output,total,costUsd}, projectSlug, projectPath, status:"draft", createdAt }',
      `id debe ser: ${planId}`,
      `projectSlug: ${slug}`,
      `projectPath: ${projectPath}`,
      `createdAt: ${new Date().toISOString()}`,
      'El código se generará en /proyecto/ y la DB JSON en /datos/app/',
      '',
      'Prompt del usuario:',
      userPrompt,
    ].join('\n');

    const result = await Agent.prompt(planningPrompt, {
      apiKey: this.options.apiKey!,
      model: { id: this.options.modelId ?? 'composer-2.5' },
      local: { cwd: this.options.codificaDir, settingSources: [] },
    });

    if (result.status === 'error') {
      throw new Error(`Plan SDK run failed: ${result.id}`);
    }

    const text = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
    const parsed = parsePlanFromLlm(extractJsonFromText(text));
    parsed.projectPath = projectPath;
    parsed.projectSlug = slug;
    parsed.id = planId;

    this.scaffoldProjectDirs(projectPath);
    return parsed;
  }

  private buildHeuristic(userPrompt: string, proyectoRoot: string): ProfessionalPlan {
    const slug = slugifyPrompt(userPrompt);
    const projectPath = resolve(proyectoRoot);
    const complexity = this.estimateComplexity(userPrompt);

    this.scaffoldProjectDirs(projectPath);

    const technologies = this.inferTechnologies(userPrompt);
    const schedule = this.buildSchedule(complexity);
    const tokenEstimate = this.estimateTokens(complexity);

    return {
      id: randomUUID(),
      userPrompt,
      objectives: this.extractObjectives(userPrompt),
      technologies,
      architecture: this.buildArchitectureDescription(technologies),
      risks: this.identifyRisks(userPrompt, technologies),
      schedule,
      tokenEstimate,
      projectSlug: slug,
      projectPath,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  }

  private scaffoldProjectDirs(projectPath: string): void {
    for (const dir of ['frontend', 'backend', 'docs', '.cursor']) {
      mkdirSync(join(projectPath, dir), { recursive: true });
    }
  }

  private estimateComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
    const keywords = [
      'stripe', 'supabase', 'auth', 'dashboard', 'pwa', 'saas',
      'admin', 'móvil', 'mobile', 'prisma', 'next.js', 'crm', 'json',
    ];
    const matches = keywords.filter((k) => prompt.toLowerCase().includes(k)).length;
    if (matches >= 5) return 'complex';
    if (matches >= 2) return 'medium';
    return 'simple';
  }

  private inferTechnologies(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const stack = ['Next.js 15', 'TypeScript', 'Tailwind CSS', 'Shadcn UI', 'JSON file DB (/datos/app/)'];

    if (lower.includes('supabase') || lower.includes('postgres')) {
      stack.push('Supabase', 'PostgreSQL');
    }
    if (lower.includes('stripe')) stack.push('Stripe');
    if (lower.includes('auth') || lower.includes('autentic')) stack.push('NextAuth / Clerk');
    if (lower.includes('crm')) stack.push('CRM modules');

    return [...new Set(stack)];
  }

  private extractObjectives(prompt: string): string[] {
    return [
      `Implementar: ${prompt.slice(0, 200)}${prompt.length > 200 ? '…' : ''}`,
      'Generar código en /proyecto y datos JSON en /datos/app/',
      'Trazabilidad completa y aprobación por nivel de riesgo',
      'Dejar proyecto listo para servir desde /index.html raíz',
    ];
  }

  private buildArchitectureDescription(technologies: string[]): string {
    return [
      'Código en /proyecto/ (frontend, backend, docs)',
      'DB JSON en /datos/app/',
      'Entrada pública: /index.html → /proyecto/frontend/',
      `Stack: ${technologies.join(', ')}`,
    ].join('\n');
  }

  private identifyRisks(prompt: string, technologies: string[]): string[] {
    const risks = [
      'Conflictos si agentes escriben mismos archivos — mitigar con worktrees/subcarpetas',
      'Coste tokens elevado — control via maxParallel',
    ];
    if (technologies.includes('Stripe')) {
      risks.push('Alto: claves Stripe live requieren aprobación explícita');
    }
    if (prompt.toLowerCase().includes('auth')) {
      risks.push('Medio: datos personales — cumplir RGPD');
    }
    return risks;
  }

  private buildSchedule(complexity: 'simple' | 'medium' | 'complex'): SchedulePhase[] {
    const durationMap = { simple: 2, medium: 4, complex: 6 };
    return [
      { phase: 'Análisis y Plan (Nivel 0)', durationHours: 0.5, agents: ['orchestrator-manager'] },
      { phase: 'Arquitectura (Nivel 1)', durationHours: 1, agents: ['planner'] },
      {
        phase: 'Implementación paralela (Nivel 2)',
        durationHours: durationMap[complexity],
        agents: ['frontend', 'backend', 'database', 'auth-security', 'integration'],
      },
      { phase: 'Deploy + QA', durationHours: 2, agents: ['deploy', 'qa-testing'] },
      { phase: 'Supervisión', durationHours: 1, agents: ['debug-supervisor'] },
    ];
  }

  private estimateTokens(complexity: 'simple' | 'medium' | 'complex'): TokenEstimate {
    const multiplier = { simple: 0.4, medium: 1, complex: 1.6 }[complexity];
    const input = Math.round(80000 * multiplier);
    const output = Math.round(140000 * multiplier);
    const total = input + output;
    return { input, output, total, costUsd: Math.round((total / 1_000_000) * 3 * 100) / 100 };
  }
}
export { readDefaultPrompt };