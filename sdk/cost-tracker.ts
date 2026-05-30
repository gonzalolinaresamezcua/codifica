/** Acumula tokens por plan para control de costos en dashboard Codifica. */
export class CostTracker {
  private readonly byPlan = new Map<string, number>();

  record(planId: string, tokens: number): void {
    this.byPlan.set(planId, (this.byPlan.get(planId) ?? 0) + tokens);
  }

  getSummary(planId: string): { planId: string; tokensUsed: number; costUsdEstimate: number } {
    const tokensUsed = this.byPlan.get(planId) ?? 0;
    const costUsdEstimate = Math.round((tokensUsed / 1_000_000) * 3 * 100) / 100;
    return { planId, tokensUsed, costUsdEstimate };
  }
}
