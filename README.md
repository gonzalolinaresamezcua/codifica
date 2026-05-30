# Codifica

**Codifica** is a self-hosted, multi-agent orchestration platform that turns a single natural-language prompt into a full application. It uses the official [**Cursor SDK**](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) to run specialized AI agents in parallel — frontend, backend, database, auth, integrations, deploy, QA, and supervision.

Think of it as a **mini factory for software**: you describe what you want (e.g. *"Build a CRM SaaS with Next.js 15, JSON file database, auth, and admin dashboard"*), Codifica plans the work, coordinates agents, and writes generated code **outside** its own folder.

---

## What makes Codifica different

| Feature | Description |
|---------|-------------|
| **Single prompt in → app out** | One textarea + Enter starts planning and execution |
| **Multi-agent hierarchy** | Orchestrator → Planner → 8 specialist agents (parallel) |
| **Cursor SDK native** | Real `Agent.create()` / streaming / cost tracking — not a mock |
| **JSON-only persistence** | No SQLite/Postgres for platform data — plain JSON files |
| **Deployable folder** | Copy `/codifica` to a server; bootstrap creates `/datos` and `/proyecto` |
| **Risk levels** | Low / Medium / High approval gates (inspired by autonomous agent safety patterns) |
| **Full traceability** | Every agent action logged to JSON for audit and UI streaming |

---

## Architecture

```
/deploy-root/                    ← CODIFICA_ROOT (your server root)
├── codifica/                    ← This repo — the brain (never contains user app code)
│   ├── agents/                  ← Agent definitions & MainAgent facade
│   ├── orchestrator/            ← Plan, decompose, parallel run, bootstrap, risk
│   ├── sdk/                     ← @cursor/sdk wrapper
│   ├── prompts/                 ← System prompts per agent role (.md)
│   ├── config/                  ← Default prompt, risk policies
│   ├── templates/               ← Root index.html, .htaccess, README templates
│   ├── public/                  ← Orchestrator UI assets
│   ├── ui/                      ← Optional Next.js dashboard
│   ├── index.html               ← Admin UI (prompt + Enter)
│   └── server.ts                ← HTTP server + REST/SSE API
│
├── datos/                       ← Platform JSON database (auto-created)
│   ├── plans/                   ← Professional plans
│   ├── traces/                  ← Agent trace logs
│   ├── app/                     ← Generated app's JSON DB (CRM data, etc.)
│   └── settings.json
│
├── proyecto/                    ← Generated source code (auto-created)
│   ├── frontend/
│   ├── backend/
│   └── docs/
│
├── index.html                   ← Public entry → loads /proyecto/frontend/
├── .htaccess                    ← Apache rules
└── README.md
```

### Two `index.html` files

| URL | Audience | Purpose |
|-----|----------|---------|
| `/codifica/index.html` | **You (admin)** | Write prompts, approve plans, launch agents |
| `/index.html` (root) | **End users** | Open the generated application |

---

## Agent hierarchy

```
Level 0 — Orchestrator Manager    Receives prompt, creates Professional Plan
Level 1 — Planner                 Architecture, stack, folder structure
Level 2 — Specialists (parallel)
          ├── Frontend            Next.js 15, UI/UX
          ├── Backend             APIs, business logic
          ├── Database            JSON schemas in /datos/app/
          ├── Auth & Security     Login, roles, GDPR
          ├── Integration         Stripe, email, webhooks
          ├── Deploy              Vercel/Docker/CI
          ├── QA & Testing        Jest, Playwright
          └── Debug Supervisor    Final review + report
Level 3 — Dynamic sub-agents      Created inline via Cursor SDK when needed
```

---

## Quick start

### Requirements

- **Node.js 18+**
- **Cursor API key** — [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)  
  Required for real agent execution. Without it, Codifica runs in **scaffold mode** (writes placeholder README files).

### Install & run

```bash
cd codifica
npm install
cp .env.example .env
# Edit .env — set CURSOR_API_KEY

npm run build
npm start
```

Open **http://localhost:3000/codifica/index.html**

The default prompt is pre-filled (CRM SaaS example). Press **Enter** or click the button to generate a plan, then **Execute agents**.

### CLI (alternative)

```bash
npm run build
npm run dev:cli -- plan "Build a task manager with Next.js 15"
npm run dev:cli -- approve <plan-id> --alto
npm run dev:cli -- execute <plan-id> --parallel=3
npm run dev:cli -- list
npm run dev:cli -- trace <plan-id>
npm run demo    # Uses the built-in CRM example prompt
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODIFICA_ROOT` | Parent of `codifica/` | Deploy root folder |
| `CODIFICA_DATOS_ROOT` | `{ROOT}/datos` | JSON database path |
| `CODIFICA_PROYECTO_ROOT` | `{ROOT}/proyecto` | Generated code path |
| `CURSOR_API_KEY` | — | Cursor SDK authentication |
| `CODIFICA_MODEL_ID` | `composer-2.5` | Model for all agents |
| `CODIFICA_MAX_PARALLEL` | `3` | Max concurrent agents |
| `PORT` | `3000` | HTTP server port |

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bootstrap` | Create `/datos`, `/proyecto`, root files |
| GET | `/api/default-prompt` | CRM example prompt |
| POST | `/api/plan` | `{ "prompt": "..." }` → Professional Plan |
| GET | `/api/plans` | List all plans |
| GET | `/api/plans/:id` | Get plan by ID |
| POST | `/api/plans/:id/approve` | Approve plan (+ optional risk flags) |
| POST | `/api/plans/:id/execute` | Run agents (SSE stream) |
| GET | `/api/traces/:planId` | Trace events |
| GET | `/api/export/template` | Export agent registry as JSON |

---

## Deploy to a server

1. Create a deploy folder, e.g. `/var/www/my-app/`
2. Copy the **`codifica/`** folder inside (without `node_modules`)
3. Configure `.env` with **absolute paths**
4. Run `npm install && npm run build && npm start`
5. Point Apache/Nginx DocumentRoot to the deploy folder

On first access, bootstrap creates `datos/`, `proyecto/`, root `index.html`, `.htaccess`, and `README.md`.

---

## Optional Next.js dashboard

```bash
cd ui
npm install
npm run dev   # http://localhost:3001 — proxies API to :3000
```

---

## Security notes

- **Never commit** `.env` or `CURSOR_API_KEY`
- `/datos/` is blocked by `.htaccess` from direct web access
- High-risk tasks (deploy, production) require explicit approval
- Generated apps live in `/proyecto/` — review before exposing publicly

---

## Project size

| Component | Approx. size |
|-----------|--------------|
| `codifica/` with `node_modules` | ~66 MB |
| `codifica/` source only (no deps) | ~2 MB |
| `/datos` + `/proyecto` at runtime | grows with your apps |

---

## License

MIT — see [LICENSE](LICENSE).

## Author

Open-source project exploring multi-agent software generation with the Cursor SDK.
