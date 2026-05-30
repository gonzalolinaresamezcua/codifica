#!/usr/bin/env node
import { createCodificaContext } from './orchestrator/context.js';
import { readDefaultPrompt } from './orchestrator/bootstrap.js';

const moduleUrl = import.meta.url;
const ctx = createCodificaContext(moduleUrl);

async function cmdPlan(prompt: string): Promise<void> {
  const plan = await ctx.agent.analyzeAndPlan(prompt);
  console.log('\n=== CODIFICA — Plan Profesional ===\n');
  console.log(`ID:       ${plan.id}`);
  console.log(`Proyecto: ${plan.projectSlug}`);
  console.log(`Ruta:     ${plan.projectPath}`);
  console.log(`Tokens:   ${plan.tokenEstimate.total} (~$${plan.tokenEstimate.costUsd} USD)`);
  console.log(`Estado:   ${plan.status}`);
  console.log('\nObjetivos:');
  plan.objectives.forEach((o) => console.log(`  • ${o}`));
  console.log('\nStack:', plan.technologies.join(', '));
}

async function cmdApprove(planId: string, approveAlto: boolean): Promise<void> {
  const plan = ctx.agent.getPlan(planId);
  if (!plan) throw new Error(`Plan no encontrado: ${planId}`);
  const riskApprovals = approveAlto ? { 'alto:all': true } : undefined;
  ctx.agent.approvePlan(plan, riskApprovals);
  console.log(`Plan ${planId} aprobado.`);
}

async function cmdExecute(planId: string, parallel: number): Promise<void> {
  let plan = ctx.agent.getPlan(planId);
  if (!plan) throw new Error(`Plan no encontrado: ${planId}`);
  if (plan.status === 'draft') {
    plan = ctx.agent.approvePlan(plan, { 'alto:all': true });
  }
  const { plan: done } = await ctx.agent.executeApprovedPlan(plan, parallel);
  console.log(`Ejecución finalizada: ${done.status}`);
}

async function cmdTrace(planId: string): Promise<void> {
  const events = ctx.agent.getTrace(planId);
  for (const e of events) {
    console.log(`[${e.timestamp}] ${e.agentRole} ${e.action}: ${e.detail.slice(0, 120)}`);
  }
}

async function cmdList(): Promise<void> {
  for (const p of ctx.agent.listPlans()) {
    console.log(`${p.id}  ${p.status.padEnd(10)}  ${p.projectSlug}`);
  }
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (command === 'plan' && args.length > 0) {
    await cmdPlan(args.join(' '));
    return;
  }
  if (command === 'approve' && args[0]) {
    await cmdApprove(args[0], args.includes('--alto'));
    return;
  }
  if (command === 'execute' && args[0]) {
    const parallel = Number(args.find((a) => a.startsWith('--parallel='))?.split('=')[1] ?? process.env.CODIFICA_MAX_PARALLEL ?? 3);
    await cmdExecute(args[0], parallel);
    return;
  }
  if (command === 'trace' && args[0]) {
    await cmdTrace(args[0]);
    return;
  }
  if (command === 'list') {
    await cmdList();
    return;
  }
  if (command === 'demo') {
    const prompt = readDefaultPrompt(ctx.paths.codificaDir);
    await cmdPlan(prompt);
    return;
  }

  console.log(`
Codifica CLI

  plan "<prompt>"              Genera plan profesional
  approve <plan-id> [--alto]   Aprueba plan
  execute <plan-id> [--parallel=N]
  trace <plan-id>              Trazabilidad
  list                         Listar planes
  demo                         Plan CRM de ejemplo

Orquestador web: npm start → /codifica/index.html
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
