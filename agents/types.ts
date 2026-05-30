/** Nivel de riesgo para aprobación (inspirado en AITarea). */
export type RiskLevel = 'bajo' | 'medio' | 'alto';

/** Roles de agentes en la jerarquía Codifica. */
export type AgentRole =
  | 'orchestrator-manager'
  | 'planner'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'auth-security'
  | 'integration'
  | 'deploy'
  | 'qa-testing'
  | 'debug-supervisor';

export type AgentLevel = 0 | 1 | 2 | 3;

export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'failed';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Estimación de tokens y costo del Plan Profesional. */
export interface TokenEstimate {
  input: number;
  output: number;
  total: number;
  costUsd: number;
}

/** Fase del cronograma del plan. */
export interface SchedulePhase {
  phase: string;
  durationHours: number;
  agents: AgentRole[];
}

/**
 * Plan Profesional generado por el Agente Principal (Nivel 0).
 * Incluye objetivos, stack, arquitectura, riesgos, cronograma y tokens.
 */
export interface ProfessionalPlan {
  id: string;
  userPrompt: string;
  objectives: string[];
  technologies: string[];
  architecture: string;
  risks: string[];
  schedule: SchedulePhase[];
  tokenEstimate: TokenEstimate;
  projectSlug: string;
  /** Ruta absoluta bajo /proyecto */
  projectPath: string;
  status: PlanStatus;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  overnightMode?: boolean;
  riskApprovals?: Record<string, boolean>;
}

/** Tarea delegada a un agente especialista. */
export interface AgentTask {
  id: string;
  planId: string;
  agentRole: AgentRole;
  level: AgentLevel;
  prompt: string;
  cwd: string;
  worktreeBranch: string | null;
  riskLevel: RiskLevel;
  dependsOn: string[];
  status: TaskStatus;
}

/** Evento de trazabilidad para logs y UI. */
export interface TraceEvent {
  id: string;
  timestamp: string;
  planId?: string;
  taskId?: string;
  agentId?: string;
  agentRole: AgentRole | string;
  action: string;
  detail: string;
  riskLevel: RiskLevel;
  tokensUsed: number | null;
}

/** Definición de un agente en el registro. */
export interface AgentDefinition {
  id: AgentRole;
  name: string;
  level: AgentLevel;
  description: string;
  defaultRiskLevel: RiskLevel;
  promptFile: string;
}

/** Opciones de ejecución paralela. */
export interface ParallelRunOptions {
  maxParallel: number;
  onEvent: (event: TraceEvent) => void;
  onTaskStart?: (task: AgentTask) => void;
  onTaskComplete?: (task: AgentTask) => void;
}

/** Resultado de ejecutar una tarea vía Cursor SDK. */
export interface TaskExecutionResult {
  task: AgentTask;
  success: boolean;
  summary: string;
  eventsCount: number;
  tokensUsed: number;
  usedFallback: boolean;
}
