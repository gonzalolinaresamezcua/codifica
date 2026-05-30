import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_REGISTRY } from '../agents/registry.js';
import type { AgentRole } from '../agents/types.js';

/** Carga system prompt desde prompts/*.md */
export function loadAgentPrompt(codificaDir: string, role: AgentRole): string {
  const def = AGENT_REGISTRY.find((a) => a.id === role);
  if (!def?.promptFile) return '';
  const path = join(codificaDir, def.promptFile);
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return def.description;
  }
}

export function buildFullTaskPrompt(
  codificaDir: string,
  role: AgentRole,
  contextPrompt: string
): string {
  const system = loadAgentPrompt(codificaDir, role);
  return [system, '', '---', '', contextPrompt].filter(Boolean).join('\n');
}
