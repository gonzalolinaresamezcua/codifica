import type { ProfessionalPlan, TraceEvent } from './types.js';
import { CodificaOrchestrator } from '../orchestrator/main-orchestrator.js';

export class MainAgent {
  constructor(private readonly orchestrator: CodificaOrchestrator) {}

  async analyzeAndPlan(userPrompt: string): Promise<ProfessionalPlan> {
    return this.orchestrator.createPlan(userPrompt);
  }

  approvePlan(
    plan: ProfessionalPlan,
    riskApprovals?: Record<string, boolean>
  ): ProfessionalPlan {
    return this.orchestrator.approvePlan(plan, riskApprovals);
  }

  async executeApprovedPlan(
    plan: ProfessionalPlan,
    maxParallel?: number,
    onEvent?: (e: TraceEvent) => void
  ): Promise<{ plan: ProfessionalPlan; trace: TraceEvent[] }> {
    const completed = await this.orchestrator.approveAndExecute(plan, maxParallel, onEvent);
    return {
      plan: completed,
      trace: this.orchestrator.getTrace(completed.id),
    };
  }

  getPlan(planId: string): ProfessionalPlan | null {
    return this.orchestrator.getPlan(planId);
  }

  listPlans(): ProfessionalPlan[] {
    return this.orchestrator.listPlans();
  }

  getTrace(planId: string): TraceEvent[] {
    return this.orchestrator.getTrace(planId);
  }
}
