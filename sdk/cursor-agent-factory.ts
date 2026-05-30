import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Agent, CursorAgentError } from '@cursor/sdk';
import type { AgentTask, TaskExecutionResult, TraceEvent } from '../agents/types.js';
import { EventStreamHandler, extractTextFromEvent } from './event-stream-handler.js';
import { CostTracker } from './cost-tracker.js';

export interface CursorAgentFactoryOptions {
  apiKey?: string;
  modelId?: string;
}

export class CursorAgentFactory {
  private readonly apiKey?: string;
  private readonly modelId: string;
  private readonly costTracker = new CostTracker();

  constructor(options: CursorAgentFactoryOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.CURSOR_API_KEY;
    this.modelId = options.modelId ?? process.env.CODIFICA_MODEL_ID ?? 'composer-2.5';
  }

  async executeTask(
    task: AgentTask,
    onEvent?: (event: TraceEvent) => void
  ): Promise<TaskExecutionResult> {
    mkdirSync(task.cwd, { recursive: true });

    if (!this.apiKey) {
      return this.fallbackScaffold(task, onEvent);
    }

    let agent: Awaited<ReturnType<typeof Agent.create>> | null = null;

    try {
      agent = await Agent.create({
        apiKey: this.apiKey,
        model: { id: this.modelId },
        local: { cwd: task.cwd, settingSources: [] },
        agents: {
          [task.agentRole]: {
            description: task.agentRole,
            prompt: task.prompt.slice(0, 500),
          },
        },
      });

      const run = await agent.send(task.prompt);

      onEvent?.({
        id: '',
        timestamp: new Date().toISOString(),
        planId: task.planId,
        taskId: task.id,
        agentId: agent.agentId,
        agentRole: task.agentRole,
        action: 'run_started',
        detail: `run=${run.id}`,
        riskLevel: task.riskLevel,
        tokensUsed: null,
      });

      const handler = new EventStreamHandler(task, onEvent);
      let lastText = '';

      for await (const event of run.stream()) {
        handler.handle(event);
        const chunk = extractTextFromEvent(event);
        if (chunk) lastText = chunk;
      }

      const result = await run.wait();
      const tokensUsed = handler.tokensUsed;
      this.costTracker.record(task.planId, tokensUsed);

      if (result.status === 'error') {
        return {
          task,
          success: false,
          summary: `Run error: ${result.id}`,
          eventsCount: handler.eventsCount,
          tokensUsed,
          usedFallback: false,
        };
      }

      return {
        task,
        success: true,
        summary: lastText.slice(0, 500) || `Agente ${task.agentRole} completado`,
        eventsCount: handler.eventsCount,
        tokensUsed,
        usedFallback: false,
      };
    } catch (err) {
      if (err instanceof CursorAgentError) {
        onEvent?.({
          id: '',
          timestamp: new Date().toISOString(),
          planId: task.planId,
          taskId: task.id,
          agentRole: task.agentRole,
          action: 'sdk_startup_error',
          detail: `${err.message} retryable=${err.isRetryable}`,
          riskLevel: task.riskLevel,
          tokensUsed: null,
        });
        if (!err.isRetryable) {
          return this.fallbackScaffold(task, onEvent, err.message);
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.fallbackScaffold(task, onEvent, message);
    } finally {
      if (agent) await agent.close();
    }
  }

  getCostSummary(planId: string) {
    return this.costTracker.getSummary(planId);
  }

  private fallbackScaffold(
    task: AgentTask,
    onEvent?: (event: TraceEvent) => void,
    sdkError?: string
  ): TaskExecutionResult {
    const readme = join(task.cwd, 'README.md');
    const content = [
      `# ${task.agentRole}`,
      '',
      sdkError ? `Nota SDK: ${sdkError}` : 'Modo scaffold (sin CURSOR_API_KEY)',
      '',
      task.prompt.slice(0, 2000),
    ].join('\n');

    writeFileSync(readme, content, 'utf8');

    onEvent?.({
      id: '',
      timestamp: new Date().toISOString(),
      planId: task.planId,
      taskId: task.id,
      agentRole: task.agentRole,
      action: 'fallback_scaffold',
      detail: readme,
      riskLevel: 'bajo',
      tokensUsed: 0,
    });

    return {
      task,
      success: true,
      summary: `Scaffold fallback en ${readme}`,
      eventsCount: 0,
      tokensUsed: 0,
      usedFallback: true,
    };
  }
}
