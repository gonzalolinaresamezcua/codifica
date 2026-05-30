import type { AgentTask, ProfessionalPlan, TraceEvent } from '../agents/types.js';
import { CursorAgentFactory } from '../sdk/cursor-agent-factory.js';
import { upsertProjectIndex, type ProjectIndexEntry } from './bootstrap.js';
import { PlanBuilder } from './plan-builder.js';
import { PlanStore } from './plan-store.js';
import type { CodificaPaths } from './paths.js';
import { ParallelRunner } from './parallel-runner.js';
import { updateRootAfterExecution, writeProjectHooks } from './root-scaffold.js';
import { TaskDecomposer } from './task-decomposer.js';
import { TraceStore } from './trace-store.js';
import { RiskGate, WorktreeManager } from './worktree-manager.js';

export interface OrchestratorConfig extends CodificaPaths {
  apiKey?: string;
  modelId?: string;
  defaultMaxParallel?: number;
}

export class CodificaOrchestrator {
  private readonly planBuilder: PlanBuilder;
  private readonly decomposer: TaskDecomposer;
  private readonly runner: ParallelRunner;
  private readonly trace: TraceStore;
  private readonly plans: PlanStore;
  private readonly factory: CursorAgentFactory;
  private readonly defaultMaxParallel: number;
  private readonly paths: CodificaPaths;
  private readonly riskGate: RiskGate;

  constructor(config: OrchestratorConfig) {
    this.paths = config;
    this.planBuilder = new PlanBuilder({
      codificaDir: config.codificaDir,
      apiKey: config.apiKey,
      modelId: config.modelId,
    });
    this.decomposer = new TaskDecomposer(config.codificaDir);
    this.trace = new TraceStore(config.datosRoot);
    this.plans = new PlanStore(config.datosRoot);
    this.factory = new CursorAgentFactory({
      apiKey: config.apiKey,
      modelId: config.modelId ?? 'composer-2.5',
    });
    this.riskGate = new RiskGate(config.codificaDir);
    this.runner = new ParallelRunner({
      factory: this.factory,
      worktree: new WorktreeManager(),
      riskGate: this.riskGate,
      proyectoRoot: config.proyectoRoot,
    });
    this.defaultMaxParallel = config.defaultMaxParallel ?? 3;
  }

  async createPlan(userPrompt: string): Promise<ProfessionalPlan> {
    this.trace.log({
      agentRole: 'orchestrator-manager',
      action: 'analyze_prompt',
      detail: userPrompt.slice(0, 500),
      riskLevel: 'bajo',
    });

    const plan = await this.planBuilder.build(userPrompt, this.paths.proyectoRoot);
    this.plans.save(plan);

    upsertProjectIndex(this.paths.datosRoot, {
      slug: plan.projectSlug,
      planId: plan.id,
      path: plan.projectPath,
      status: plan.status,
      updatedAt: new Date().toISOString(),
    } satisfies ProjectIndexEntry);

    writeProjectHooks(this.paths.proyectoRoot, this.paths.codificaDir);

    this.trace.log({
      planId: plan.id,
      agentRole: 'orchestrator-manager',
      action: 'plan_created',
      detail: JSON.stringify({
        id: plan.id,
        slug: plan.projectSlug,
        tokens: plan.tokenEstimate.total,
      }),
      riskLevel: 'bajo',
    });

    return plan;
  }

  approvePlan(plan: ProfessionalPlan, riskApprovals?: Record<string, boolean>): ProfessionalPlan {
    plan.status = 'approved';
    plan.approvedAt = new Date().toISOString();
    if (riskApprovals) plan.riskApprovals = riskApprovals;

    this.plans.update(plan);
    this.trace.log({
      planId: plan.id,
      agentRole: 'orchestrator-manager',
      action: 'plan_approved',
      detail: plan.id,
      riskLevel: 'bajo',
    });

    return plan;
  }

  async approveAndExecute(
    plan: ProfessionalPlan,
    maxParallel = this.defaultMaxParallel,
    onEvent?: (e: TraceEvent) => void
  ): Promise<ProfessionalPlan> {
    if (plan.status !== 'approved' && plan.status !== 'executing') {
      throw new Error(`Plan debe estar approved; estado actual: ${plan.status}`);
    }

    plan.status = 'executing';
    this.plans.update(plan);

    const gate = new RiskGate(this.paths.codificaDir, plan.riskApprovals ?? {});
    this.runner.setRiskGate(gate);

    this.trace.log({
      planId: plan.id,
      agentRole: 'orchestrator-manager',
      action: 'execution_started',
      detail: `maxParallel=${maxParallel}`,
      riskLevel: 'medio',
    });

    const tasks = this.decomposer.decompose(plan);

    await this.runner.runAll(tasks, {
      maxParallel,
      onEvent: (e) => {
        this.trace.log({ ...e, planId: plan.id });
        onEvent?.(e);
      },
    });

    const failed = tasks.filter((t) => t.status === 'failed');
    plan.status = failed.length > 0 ? 'failed' : 'completed';
    plan.completedAt = new Date().toISOString();
    this.plans.update(plan);

    upsertProjectIndex(this.paths.datosRoot, {
      slug: plan.projectSlug,
      planId: plan.id,
      path: plan.projectPath,
      status: plan.status,
      updatedAt: plan.completedAt,
    });

    updateRootAfterExecution(this.paths.mainRoot, this.paths.codificaDir, plan);

    this.trace.log({
      planId: plan.id,
      agentRole: 'orchestrator-manager',
      action: 'execution_finished',
      detail: `${tasks.length - failed.length}/${tasks.length} OK`,
      riskLevel: 'bajo',
    });

    return plan;
  }

  getPlan(id: string): ProfessionalPlan | null {
    return this.plans.load(id);
  }

  listPlans(): ProfessionalPlan[] {
    return this.plans.list();
  }

  getTrace(planId: string): TraceEvent[] {
    return this.trace.getByPlan(planId);
  }
}
