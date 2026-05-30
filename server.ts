import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createCodificaContext } from './orchestrator/context.js';
import { readDefaultPrompt } from './orchestrator/bootstrap.js';
import { readJsonFile, writeJsonFile } from './orchestrator/json-store.js';
import { saveLearning } from './orchestrator/context.js';
import type { TraceEvent } from './agents/types.js';

const moduleUrl = import.meta.url;
const ctx = createCodificaContext(moduleUrl);
const { paths } = ctx;
const PORT = Number(process.env.PORT ?? 3000);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveFile(res: ServerResponse, filePath: string): void {
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const method = req.method ?? 'GET';

  if (pathname === '/api/bootstrap' && method === 'GET') {
    sendJson(res, 200, { ok: true, paths });
    return;
  }

  if (pathname === '/api/default-prompt' && method === 'GET') {
    sendJson(res, 200, { prompt: readDefaultPrompt(paths.codificaDir) });
    return;
  }

  if (pathname === '/api/plan' && method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { prompt?: string };
    if (!body.prompt?.trim()) {
      sendJson(res, 400, { error: 'prompt requerido' });
      return;
    }
    const plan = await ctx.agent.analyzeAndPlan(body.prompt.trim());
    sendJson(res, 200, plan);
    return;
  }

  if (pathname === '/api/plans' && method === 'GET') {
    sendJson(res, 200, ctx.agent.listPlans());
    return;
  }

  const planMatch = pathname.match(/^\/api\/plans\/([^/]+)$/);
  if (planMatch && method === 'GET') {
    const plan = ctx.agent.getPlan(planMatch[1]!);
    if (!plan) sendJson(res, 404, { error: 'Plan no encontrado' });
    else sendJson(res, 200, plan);
    return;
  }

  const approveMatch = pathname.match(/^\/api\/plans\/([^/]+)\/approve$/);
  if (approveMatch && method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { riskApprovals?: Record<string, boolean> };
    const plan = ctx.agent.getPlan(approveMatch[1]!);
    if (!plan) {
      sendJson(res, 404, { error: 'Plan no encontrado' });
      return;
    }
    sendJson(res, 200, ctx.agent.approvePlan(plan, body.riskApprovals ?? { 'alto:all': true }));
    return;
  }

  const executeMatch = pathname.match(/^\/api\/plans\/([^/]+)\/execute$/);
  if (executeMatch && method === 'POST') {
    const planId = executeMatch[1]!;
    let plan = ctx.agent.getPlan(planId);
    if (!plan) {
      sendJson(res, 404, { error: 'Plan no encontrado' });
      return;
    }

    const body = JSON.parse(await readBody(req)) as {
      maxParallel?: number;
      overnight?: boolean;
      riskApprovals?: Record<string, boolean>;
    };

    if (plan.status === 'draft') {
      plan = ctx.agent.approvePlan(plan, body.riskApprovals ?? { 'alto:all': true });
    }

    if (body.overnight) {
      plan.overnightMode = true;
      ctx.orchestrator.approvePlan(plan);
      const settingsPath = join(paths.datosRoot, 'settings.json');
      writeJsonFile(settingsPath, {
        ...readJsonFile(settingsPath, {}),
        overnightPlanId: plan.id,
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (event: TraceEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const { plan: done } = await ctx.agent.executeApprovedPlan(
        plan,
        body.maxParallel ?? Number(process.env.CODIFICA_MAX_PARALLEL ?? 3),
        send
      );
      send({
        id: '',
        timestamp: new Date().toISOString(),
        planId: done.id,
        agentRole: 'orchestrator-manager',
        action: 'done',
        detail: done.status,
        riskLevel: 'bajo',
        tokensUsed: null,
      });
      saveLearning(paths.datosRoot, done.projectSlug, {
        prompt: done.userPrompt,
        technologies: done.technologies,
        status: done.status,
      });
    } catch (err) {
      send({
        id: '',
        timestamp: new Date().toISOString(),
        planId,
        agentRole: 'orchestrator-manager',
        action: 'error',
        detail: err instanceof Error ? err.message : String(err),
        riskLevel: 'alto',
        tokensUsed: null,
      });
    }

    res.end();
    return;
  }

  const traceMatch = pathname.match(/^\/api\/traces\/([^/]+)$/);
  if (traceMatch && method === 'GET') {
    sendJson(res, 200, ctx.agent.getTrace(traceMatch[1]!));
    return;
  }

  const exportMatch = pathname.match(/^\/api\/export\/template$/);
  if (exportMatch && method === 'GET') {
    const { AGENT_REGISTRY } = await import('./agents/registry.js');
    sendJson(res, 200, { agents: AGENT_REGISTRY });
    return;
  }

  sendJson(res, 404, { error: 'API route not found' });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    let pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    // Raíz carpeta principal
    if (pathname === '/index.html' || pathname === '/') {
      const rootIndex = join(paths.mainRoot, pathname === '/' ? 'index.html' : 'index.html');
      if (existsSync(rootIndex)) {
        serveFile(res, rootIndex);
        return;
      }
    }

    if (pathname.startsWith('/proyecto/')) {
      const file = join(paths.mainRoot, pathname);
      serveFile(res, file);
      return;
    }

    if (pathname.startsWith('/codifica/public/')) {
      serveFile(res, join(paths.codificaDir, pathname.replace('/codifica/', '')));
      return;
    }

    if (pathname === '/codifica/index.html' || pathname === '/codifica/') {
      serveFile(res, join(paths.codificaDir, 'index.html'));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`Codifica server http://localhost:${PORT}/codifica/index.html`);
  console.log(`Carpeta principal: ${paths.mainRoot}`);
  console.log(`Datos: ${paths.datosRoot} | Proyecto: ${paths.proyectoRoot}`);
});
