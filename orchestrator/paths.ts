import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CodificaPaths {
  codificaDir: string;
  mainRoot: string;
  datosRoot: string;
  proyectoRoot: string;
  datosAppRoot: string;
}

/** Resuelve rutas de carpeta principal, /datos y /proyecto. */
export function resolvePaths(fromModuleUrl?: string): CodificaPaths {
  const codificaDir = fromModuleUrl
    ? resolve(dirname(fileURLToPath(fromModuleUrl)), '..')
    : resolve(process.cwd());

  const mainRoot = process.env.CODIFICA_ROOT
    ? resolve(process.env.CODIFICA_ROOT)
    : resolve(codificaDir, '..');

  const datosRoot = process.env.CODIFICA_DATOS_ROOT
    ? resolve(process.env.CODIFICA_DATOS_ROOT)
    : join(mainRoot, 'datos');

  const proyectoRoot = process.env.CODIFICA_PROYECTO_ROOT
    ? resolve(process.env.CODIFICA_PROYECTO_ROOT)
    : join(mainRoot, 'proyecto');

  return {
    codificaDir,
    mainRoot,
    datosRoot,
    proyectoRoot,
    datosAppRoot: join(datosRoot, 'app'),
  };
}
