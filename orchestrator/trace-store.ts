import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { TraceEvent } from '../agents/types.js';
import { JsonStore } from './json-store.js';

/**
 * Trazabilidad — persiste en datos/traces/{planId}.json
 */
export class TraceStore {
  private readonly cache = new Map<string, TraceEvent[]>();
  private readonly store: JsonStore<TraceEvent[]>;
  private readonly tracesDir: string;

  constructor(datosRoot: string) {
    this.tracesDir = join(datosRoot, 'traces');
    this.store = new JsonStore<TraceEvent[]>(this.tracesDir);
  }

  log(partial: Omit<TraceEvent, 'id' | 'timestamp' | 'tokensUsed'> & {
    timestamp?: string;
    tokensUsed?: number | null;
  }): TraceEvent {
    const event: TraceEvent = {
      id: randomUUID(),
      timestamp: partial.timestamp ?? new Date().toISOString(),
      planId: partial.planId,
      taskId: partial.taskId,
      agentId: partial.agentId,
      agentRole: partial.agentRole,
      action: partial.action,
      detail: partial.detail,
      riskLevel: partial.riskLevel,
      tokensUsed: partial.tokensUsed ?? null,
    };

    const planKey = partial.planId ?? '_global';
    const list = this.cache.get(planKey) ?? this.loadFromDisk(planKey);
    list.push(event);
    this.cache.set(planKey, list);

    if (partial.planId) {
      this.store.save(partial.planId, list);
    }

    return event;
  }

  getByPlan(planId: string): TraceEvent[] {
    if (this.cache.has(planId)) return [...this.cache.get(planId)!];
    const fromDisk = this.loadFromDisk(planId);
    this.cache.set(planId, fromDisk);
    return [...fromDisk];
  }

  private loadFromDisk(planId: string): TraceEvent[] {
    if (planId === '_global') return [];
    return this.store.load(planId) ?? [];
  }
}
