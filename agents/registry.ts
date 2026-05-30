import type { AgentDefinition } from './types.js';

/**
 * Registro de agentes Codifica — jerarquía Nivel 0-2.
 * Nivel 3 (sub-agentes recursivos) se crean dinámicamente vía Cursor SDK.
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: 'orchestrator-manager',
    name: 'Agente Principal (Orchestrator / Manager)',
    level: 0,
    description: 'Recibe prompt, genera Plan Profesional, coordina y traza',
    defaultRiskLevel: 'bajo',
    promptFile: 'prompts/orchestrator-manager.md',
  },
  {
    id: 'planner',
    name: 'Agente Planificador',
    level: 1,
    description: 'Arquitectura técnica, stack y estructura de carpetas',
    defaultRiskLevel: 'bajo',
    promptFile: 'prompts/planner.md',
  },
  {
    id: 'frontend',
    name: 'Frontend Agent',
    level: 2,
    description: 'Next.js 15, App Router, componentes, UI/UX profesional',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/frontend.md',
  },
  {
    id: 'backend',
    name: 'Backend Agent',
    level: 2,
    description: 'API routes, lógica de negocio, integraciones',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/backend.md',
  },
  {
    id: 'database',
    name: 'Database Agent',
    level: 2,
    description: 'Schema, migraciones Prisma + Supabase/PostgreSQL',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/database.md',
  },
  {
    id: 'auth-security',
    name: 'Auth & Security Agent',
    level: 2,
    description: 'NextAuth/Clerk, roles, permisos, RGPD',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/auth-security.md',
  },
  {
    id: 'integration',
    name: 'Integration Agent',
    level: 2,
    description: 'Stripe, Resend, webhooks, APIs externas',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/integration.md',
  },
  {
    id: 'deploy',
    name: 'Deploy Agent',
    level: 2,
    description: 'Vercel / Docker + CI/CD',
    defaultRiskLevel: 'alto',
    promptFile: 'prompts/deploy.md',
  },
  {
    id: 'qa-testing',
    name: 'QA & Testing Agent',
    level: 2,
    description: 'Jest, Playwright, validación de calidad',
    defaultRiskLevel: 'medio',
    promptFile: 'prompts/qa-testing.md',
  },
  {
    id: 'debug-supervisor',
    name: 'Debug & Supervisor Agent',
    level: 2,
    description: 'Revisa calidad, detecta errores, propone correcciones',
    defaultRiskLevel: 'bajo',
    promptFile: 'prompts/debug-supervisor.md',
  },
];

export function getAgentDefinition(role: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === role);
}
