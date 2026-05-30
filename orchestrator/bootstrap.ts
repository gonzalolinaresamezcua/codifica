import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from './json-store.js';
import type { CodificaPaths } from './paths.js';

export interface BootstrapResult {
  mainRoot: string;
  datosRoot: string;
  proyectoRoot: string;
  created: string[];
}

function ensureFromTemplate(
  mainRoot: string,
  codificaDir: string,
  targetName: string,
  templateName: string,
  created: string[]
): void {
  const target = join(mainRoot, targetName);
  if (existsSync(target)) return;
  const template = join(codificaDir, 'templates', templateName);
  copyFileSync(template, target);
  created.push(targetName);
}

/** Crea /datos, /proyecto y archivos raíz en la carpeta principal. */
export function bootstrap(paths: CodificaPaths): BootstrapResult {
  const { mainRoot, datosRoot, proyectoRoot, codificaDir } = paths;
  const created: string[] = [];

  const dirs = [
    join(datosRoot, 'plans'),
    join(datosRoot, 'traces'),
    join(datosRoot, 'learnings'),
    join(datosRoot, 'app'),
    join(proyectoRoot, 'frontend'),
    join(proyectoRoot, 'backend'),
    join(proyectoRoot, 'docs'),
    join(proyectoRoot, '.cursor'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }

  ensureFromTemplate(mainRoot, codificaDir, 'index.html', 'root-index.html', created);
  ensureFromTemplate(mainRoot, codificaDir, '.htaccess', 'root.htaccess', created);
  ensureFromTemplate(mainRoot, codificaDir, 'README.md', 'root-README.md', created);

  const settingsPath = join(datosRoot, 'settings.json');
  if (!existsSync(settingsPath)) {
    writeJsonFile(settingsPath, {
      maxParallel: Number(process.env.CODIFICA_MAX_PARALLEL ?? 3),
      modelId: process.env.CODIFICA_MODEL_ID ?? 'composer-2.5',
      overnightMode: false,
    });
    created.push('datos/settings.json');
  }

  const indexPath = join(datosRoot, 'projects-index.json');
  if (!existsSync(indexPath)) {
    writeJsonFile(indexPath, []);
    created.push('datos/projects-index.json');
  }

  return { mainRoot, datosRoot, proyectoRoot, created };
}

export function readDefaultPrompt(codificaDir: string): string {
  const file = join(codificaDir, 'config', 'default-prompt.txt');
  return readFileSync(file, 'utf8').trim();
}

export interface ProjectIndexEntry {
  slug: string;
  planId: string;
  path: string;
  status: string;
  updatedAt: string;
}

export function upsertProjectIndex(
  datosRoot: string,
  entry: ProjectIndexEntry
): void {
  const file = join(datosRoot, 'projects-index.json');
  const list = readJsonFile<ProjectIndexEntry[]>(file, []);
  const idx = list.findIndex((e) => e.planId === entry.planId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeJsonFile(file, list);
}
