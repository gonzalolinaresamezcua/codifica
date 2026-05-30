import { z } from 'zod';
import type { ProfessionalPlan } from '../agents/types.js';

const tokenEstimateSchema = z.object({
  input: z.number(),
  output: z.number(),
  total: z.number(),
  costUsd: z.number(),
});

const schedulePhaseSchema = z.object({
  phase: z.string(),
  durationHours: z.number(),
  agents: z.array(z.string()),
});

export const professionalPlanSchema = z.object({
  id: z.string().uuid(),
  userPrompt: z.string(),
  objectives: z.array(z.string()),
  technologies: z.array(z.string()),
  architecture: z.string(),
  risks: z.array(z.string()),
  schedule: z.array(schedulePhaseSchema),
  tokenEstimate: tokenEstimateSchema,
  projectSlug: z.string(),
  projectPath: z.string(),
  status: z.enum(['draft', 'approved', 'executing', 'completed', 'failed']),
  createdAt: z.string(),
  approvedAt: z.string().optional(),
  completedAt: z.string().optional(),
  overnightMode: z.boolean().optional(),
  riskApprovals: z.record(z.boolean()).optional(),
});

export function parsePlanFromLlm(json: unknown): ProfessionalPlan {
  return professionalPlanSchema.parse(json) as ProfessionalPlan;
}

/** Extrae JSON de respuesta LLM (markdown fence o texto plano). */
export function extractJsonFromText(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1]!.trim() : text.trim();
  return JSON.parse(raw);
}
