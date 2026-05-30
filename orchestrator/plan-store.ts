import { join } from 'node:path';
import type { ProfessionalPlan } from '../agents/types.js';
import { JsonStore } from './json-store.js';

export class PlanStore {
  private readonly store: JsonStore<ProfessionalPlan>;

  constructor(datosRoot: string) {
    this.store = new JsonStore<ProfessionalPlan>(join(datosRoot, 'plans'));
  }

  save(plan: ProfessionalPlan): void {
    this.store.save(plan.id, plan);
  }

  load(id: string): ProfessionalPlan | null {
    return this.store.load(id);
  }

  list(): ProfessionalPlan[] {
    return this.store.list().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  update(plan: ProfessionalPlan): void {
    this.store.save(plan.id, plan);
  }
}
