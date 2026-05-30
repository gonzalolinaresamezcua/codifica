import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

/** Persistencia JSON con escritura atómica (.tmp + rename). */
export class JsonStore<T> {
  constructor(private readonly baseDir: string) {
    mkdirSync(baseDir, { recursive: true });
  }

  filePath(id: string): string {
    return join(this.baseDir, `${id}.json`);
  }

  load(id: string): T | null {
    const file = this.filePath(id);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  save(id: string, data: T): void {
    const file = this.filePath(id);
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    if (existsSync(file)) unlinkSync(file);
    renameSync(tmp, file);
  }

  list(): T[] {
    if (!existsSync(this.baseDir)) return [];
    return readdirSync(this.baseDir)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(this.baseDir, f), 'utf8')) as T;
        } catch {
          return null;
        }
      })
      .filter((x): x is T => x !== null);
  }

  update(id: string, patch: Partial<T>): T {
    const current = this.load(id);
    if (!current) throw new Error(`No existe registro JSON: ${id}`);
    const updated = { ...current, ...patch };
    this.save(id, updated);
    return updated;
  }

  delete(id: string): void {
    const file = this.filePath(id);
    if (existsSync(file)) unlinkSync(file);
  }
}

/** Lee/escribe un archivo JSON único (settings, index). */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile<T>(filePath: string, data: T): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  if (existsSync(filePath)) unlinkSync(filePath);
  renameSync(tmp, filePath);
}
