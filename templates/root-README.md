# Proyecto generado con Codifica

## Estructura

- `/datos/` — Base de datos JSON (planes Codifica + datos de la app en `datos/app/`)
- `/proyecto/` — Código fuente (frontend, backend, docs)
- `/codifica/` — Cerebro orquestador multi-agente
- `/index.html` — Entrada pública de la aplicación

## Arranque (desarrollo)

```bash
cd codifica
npm install
cp .env.example .env
# Editar CURSOR_API_KEY y rutas
npm run build
npm start
```

Orquestador: `http://localhost:3000/codifica/index.html`

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `CODIFICA_ROOT` | Carpeta principal (padre de codifica) |
| `CODIFICA_DATOS_ROOT` | Ruta `/datos` |
| `CODIFICA_PROYECTO_ROOT` | Ruta `/proyecto` |
| `CURSOR_API_KEY` | API key @cursor/sdk |

## Apache

DocumentRoot = esta carpeta. El `.htaccess` protege `/datos` y redirige `/` a `/proyecto/frontend/`.
