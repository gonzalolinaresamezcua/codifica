import { bootstrap } from './bootstrap.js';
import { MainAgent } from '../agents/main-agent.js';
import { CodificaOrchestrator } from './main-orchestrator.js';
import { resolvePaths } from './paths.js';

export interface CodificaContext {
  paths: ReturnType<typeof resolvePaths>;
  agent: MainAgent;
  orchestrator: CodificaOrchestrator;
}

export function createCodificaContext(fromModuleUrl: string): CodificaContext {
  const paths = resolvePaths(fromModuleUrl);
  bootstrap(paths);

  const orchestrator = new CodificaOrchestrator({
    ...paths,
    apiKey: process.env.CURSOR_API_KEY,
    modelId: process.env.CODIFICA_MODEL_ID,
    defaultMaxParallel: Number(process.env.CODIFICA_MAX_PARALLEL ?? 3),
  });

  return {
    paths,
    orchestrator,
    agent: new MainAgent(orchestrator),
  };
}

import { join } from 'node:path';
import { writeJsonFile } from './json-store.js';

/** Guarda aprendizaje tras proyecto completado. */
export function saveLearning(
  datosRoot: string,
  slug: string,
  data: Record<string, unknown>
): void {
  writeJsonFile(join(datosRoot, 'learnings', `${slug}.json`), {
    ...data,
    savedAt: new Date().toISOString(),
  });
}
