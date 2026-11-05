# TraceLedger

Mini banking fraud detection simulator using graphs and depth-first search.

Accounts are vertices, transactions are directed edges. The backend implements
the adjacency list and iterative DFS by hand, runs five rule-based detectors
over the resulting structure, and stores every finding with the evidence that
produced it. The frontend renders the graph, lets you trace reachability from
any account, and turns a saved investigation into a printable report.

> Educational simulation only. All data is synthetic and every finding is an
> indicator for human review, not proof of fraud.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v3 |
| UI | Hand-written shadcn-style primitives, Lucide icons, `@xyflow/react` |
| Backend | FastAPI, Pydantic v2, Uvicorn |
| Database | SQLite + SQLAlchemy (Postgres/Supabase optional) |
| Tests | Pytest + HTTPX, Playwright |

## Features

- Hand-written directed graph: adjacency list, iterative DFS (explicit stack and
  visited set), cycle detection, weakly connected components. No NetworkX.
- Five detection rules with severity and structured evidence: transaction
  chain, circular flow, rapid movement, high-value transfer, suspicious
  intermediary.
- Anonymous, server-managed workspaces isolated by an HttpOnly cookie. No
  account can read another workspace's data.
- Demo dataset of 15 accounts and 28 transactions covering every pattern, plus
  two disconnected accounts, with one-click reset.
- Interactive graph with DFS highlighting, node/edge inspectors and minimap.
- Investigations saved to history; reports with print layout and CSV export.
- Money stored as integer paise everywhere and formatted in Indian notation.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/dashboard` | Workspace totals, risk mix, recent activity |
| `/accounts` | Create, search, edit and delete accounts |
| `/transactions` | Create directed transfers, sort, search, delete |
| `/investigations` | Run DFS, view findings, browse history |
| `/network` | Graph canvas, DFS overlay, components and cycles |
| `/reports` | Printable report, findings CSV, DFS CSV |
| `/settings` | Session details, reset, delete workspace |

## Project structure

```
TraceLedger/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router mounting
│   │   ├── database.py          # engine, models, get_db
│   │   ├── dependencies.py      # session cookie/header resolution
│   │   ├── schemas.py           # Pydantic contracts
│   │   ├── graph.py             # adjacency list, DFS, cycles, components
│   │   ├── demo_data.py         # synthetic dataset + reset seeding
│   │   ├── routers/             # sessions, accounts, transactions, graph,
│   │   │                        # detection, investigations
│   │   └── services/            # business logic per domain
│   ├── tests/                   # 30 Pytest tests
│   ├── requirements.txt
│   └── requirements-postgres.txt
├── frontend/
│   ├── src/app/                 # landing page + (app) route group
│   ├── src/components/          # app shell, graph canvas, UI primitives
│   ├── src/lib/                 # API client, INR/CSV utilities
│   ├── e2e/smoke.spec.ts        # 7 Playwright specs
│   └── playwright.config.ts
├── docs/
│   ├── architecture.md
│   ├── graph-and-dfs.md
│   ├── api.md
│   ├── testing.md
│   └── progress.md
├── render.yaml                  # Render blueprint (frontend + API)
└── README.md
```

## Quick start

### 1. Backend

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate the venv and run
`uvicorn app.main:app --reload --port 8000`.

- API: <http://localhost:8000>
- Swagger: <http://localhost:8000/docs>
- The SQLite file `backend/traceledger.db` is created on first start.

### 2. Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local
npm.cmd run dev
```

Open <http://localhost:3000>. The first request creates an anonymous workspace,
seeds the demo data, and sets the HttpOnly session cookie.

### 3. Tests

```powershell
# backend
cd backend
..\.venv\Scripts\python.exe -m pytest -q

# frontend (backend must be running)
cd ..\frontend
npm.cmd run test:e2e
```

See `docs/testing.md` for browser channel notes and the manual checklist.

## Demo dataset

| Pattern | Accounts |
| --- | --- |
| Transaction chain | Layered path through `ACC1001` → `ACC1002` → `ACC1003` → `ACC1004` → `ACC1005` → … |
| Circular flow | `ACC1011` → `ACC1012` → `ACC1013` → `ACC1011`, plus `ACC1014` ↔ `ACC1015` |
| Rapid movement | Four sweeps through `ACC1006`–`ACC1009` inside two hours |
| High value | ₹5,00,000 property advance `ACC1008` → `ACC1012` |
| Intermediary | `ACC1007` aggregates from two accounts and distributes to two others |
| Disconnected | `ACC1014` and `ACC1015` form a separate two-account component |

A DFS from `ACC1001` reaches 13 accounts and never reaches `ACC1014`/`ACC1015`.
That is intentional: directed reachability is not the same as "related".

## How detection works

| Rule | Trigger | Severity |
| --- | --- | --- |
| Transaction chain | Simple directed path of 3–8 accounts | `high` at length ≥ 5, else `medium` |
| Circular flow | Directed cycle of 2–6 accounts | `high` |
| Rapid movement | ≥ 3 transfers touching an account within 120 minutes | `high` at ≥ 6, else `medium` |
| High value | Single transfer ≥ ₹1,00,000 | `critical` at ≥ ₹5,00,000, else `high` |
| Intermediary | ≥ 2 distinct senders and ≥ 2 distinct receivers | `high` |

The dashboard reads counts from `GET /api/detection/summary`, which runs the
rules with `dry_run=True` so merely opening the page never writes findings.

## Money rules

- Amounts are integer paise in the API, database and TypeScript types.
- Forms convert rupees to paise once; display converts back once.
- `amount > 0` and `balance >= 0` are enforced by Pydantic.
- Formatting uses `Intl.NumberFormat("en-IN")`, e.g. `₹1,25,000.00`.

## Deployment

Both free-tier options proxy `/api/*` through the Next.js server, so the
browser only ever talks to one origin and the HttpOnly session cookie stays
first-party. No `SameSite=None` or third-party-cookie workaround is needed.

### Option A — one click on Render (frontend + API, one URL)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sharafathroshan08-ship-it/TraceLedger)

Or open this link directly:

```
https://render.com/deploy?repo=https://github.com/sharafathroshan08-ship-it/TraceLedger
```

1. Sign in to Render with GitHub (free, no card required).
2. Review the two services from `render.yaml` and approve the deploy.
3. Wait for both builds to finish, then open
   `https://traceledger-demo-web.onrender.com`.

Render's free instances sleep after ~15 minutes without traffic; the first
request afterwards can take ~40 seconds while both services cold start. There
is no persistent disk, so the SQLite file is recreated whenever the API
restarts. Workspaces are re-seeded per cookie, so the demo still works, but
edits do not survive a restart. Set `TRACELEDGER_DATABASE_URL` on the API
service to a free Supabase Postgres database if that matters.

If Render renames a service because its `onrender.com` subdomain is already
taken, update `TRACELEDGER_API_PROXY` (web) and `TRACELEDGER_ALLOWED_ORIGINS`
(api) to the assigned URLs.

### Option B — Vercel frontend + Render API

#### Backend on Render

The same `render.yaml` can be used, or create a **Web Service** manually:

1. Create a **Web Service** from the repository.
2. Root directory: `backend`.
3. Build command:
   `pip install -r requirements.txt -r requirements-postgres.txt`.
4. Start command:
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Environment:
   - `TRACELEDGER_ALLOWED_ORIGINS=https://<your-vercel-domain>`
   - `TRACELEDGER_COOKIE_SECURE=true`
   - `TRACELEDGER_DATABASE_URL=postgresql+psycopg2://...` (recommended; see below)
6. Health check path: `/api/health`.

#### Frontend on Vercel

1. Import the repository, root directory `frontend`.
2. Framework preset: Next.js. Build: `npm run build`.
3. Environment:
   - `NEXT_PUBLIC_API_BASE_URL=` (empty string — use same-origin `/api`)
   - `TRACELEDGER_API_PROXY=https://<your-render-service>.onrender.com`

`NEXT_PUBLIC_API_BASE_URL` is inlined at build time, so set it before building.
`TRACELEDGER_API_PROXY` is read by the Next.js server and rewrites
`/api/:path*` to the backend.

### Optional: Supabase Postgres

SQLite is fine for a demo but does not survive free-tier restarts on Render. To
persist workspaces outside the instance:

1. Create a Supabase project and copy the connection string.
2. Install the optional driver: `pip install -r backend/requirements-postgres.txt`
   (the Render blueprint already installs it).
3. Set `TRACELEDGER_DATABASE_URL=postgresql+psycopg2://postgres:<password>@<host>:5432/postgres`.

Tables are created automatically on startup. There is no migration path from an
existing SQLite file; a fresh database simply seeds new workspaces on demand.

### Environment variables

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `TRACELEDGER_DATABASE_URL` | backend | `sqlite:///./traceledger.db` | Database connection |
| `TRACELEDGER_ALLOWED_ORIGINS` | backend | localhost origins | CORS allow-list |
| `TRACELEDGER_COOKIE_SECURE` | backend | `false` | Set `true` on HTTPS |
| `NEXT_PUBLIC_API_BASE_URL` | frontend build | `http://localhost:8000` | API origin; empty = same origin |
| `TRACELEDGER_API_PROXY` | frontend build | unset | Backend origin for the `/api` rewrite |

## Documentation

- `docs/architecture.md` — layers, data model, session lifecycle, deployment
- `docs/graph-and-dfs.md` — data structure, iterative DFS, complexity, worked example
- `docs/api.md` — endpoints, payloads, environment variables, curl walkthrough
- `docs/testing.md` — suites, coverage, results, manual checklist
- `docs/progress.md` — phase status, verification evidence, known issues

## Limitations

- Anonymous sessions only; there is no login or cross-device resume.
- Findings are heuristics, not fraud determinations.
- No CI pipeline yet; both suites run locally.
- `datetime.utcnow()` deprecation warnings on Python 3.12+ are known and tracked.
- SQLite is not suitable for concurrent production traffic; use Postgres.
