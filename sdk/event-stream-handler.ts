import type { SDKMessage } from '@cursor/sdk';
import type { AgentTask, TraceEvent } from '../agents/types.js';

/** Extrae texto acumulable de un evento SDK. */
export function extractTextFromEvent(event: SDKMessage): string {
  if (event.type === 'assistant') {
    return event.message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  if (event.type === 'thinking' || event.type === 'task') {
    return event.text ?? '';
  }
  return '';
}

/**
 * Normaliza eventos stream del Cursor SDK para logs y UI Codifica.
 */
export class EventStreamHandler {
  eventsCount = 0;
  tokensUsed = 0;

  constructor(
    private readonly task: AgentTask,
    private readonly onEvent?: (event: TraceEvent) => void
  ) {}

  handle(event: SDKMessage): void {
    this.eventsCount++;

    const text = extractTextFromEvent(event);
    if (text) {
      this.tokensUsed += Math.ceil(text.length / 4);
    }

    this.onEvent?.({
      id: '',
      timestamp: new Date().toISOString(),
      planId: this.task.planId,
      taskId: this.task.id,
      agentRole: this.task.agentRole,
      action: `sdk_${event.type}`,
      detail: this.summarizeEvent(event),
      riskLevel: this.task.riskLevel,
      tokensUsed: this.tokensUsed,
    });
  }

  private summarizeEvent(event: SDKMessage): string {
    const text = extractTextFromEvent(event);
    if (text) return text.slice(0, 200);

    if (event.type === 'tool_call') {
      return `${event.name} (${event.status})`;
    }
    if (event.type === 'status') {
      return event.status;
    }
    return event.type;
  }
}
