# Architecture

TraceLedger is a two-process application: a Next.js frontend for presentation and
a FastAPI backend that owns all data and all graph reasoning. SQLite is the
default store; any SQLAlchemy-compatible URL (for example Supabase Postgres) can
replace it through an environment variable.

```
Browser
  │  HttpOnly cookie: traceledger_session
  ▼
Next.js (App Router, client components)
  │  fetch(..., credentials: "include")
  ▼
FastAPI  ──  Session dependency  ──  per-session query filter
  │
  ├── services/       business rules, detection, DFS orchestration
  ├── graph.py        hand-written directed graph + iterative DFS
  └── SQLAlchemy      sessions, accounts, transactions, investigations, findings
```

## Backend layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routers | `backend/app/routers/` | HTTP shape, status codes, dependency injection |
| Dependencies | `backend/app/dependencies.py` | Resolve and validate the session token |
| Services | `backend/app/services/` | Validation, transactions, graph sync, detection, reports |
| Graph | `backend/app/graph.py` | Adjacency list, iterative DFS, cycles, components |
| Models | `backend/app/database.py` | SQLAlchemy tables and `get_db` session factory |
| Schemas | `backend/app/schemas.py` | Pydantic request/response contracts |
| Seed | `backend/app/demo_data.py` | Deterministic synthetic dataset |

Routers never touch ORM objects directly. They receive the session id from
`get_current_session_id`, pass it to a service, and return a Pydantic response.
Every service query filters on `session_id`, so a valid token can only ever read
its own workspace.

## Data model

| Table | Key fields | Notes |
| --- | --- | --- |
| `sessions` | `id`, `created_at`, `expires_at`, `is_active` | Anonymous workspace; 24-hour TTL |
| `accounts` | `session_id`, `account_number`, `account_holder`, `balance` | `balance` is integer paise; `(session_id, account_number)` is unique |
| `transactions` | `source_account_id`, `destination_account_id`, `amount`, `timestamp` | `amount` is integer paise and must be > 0; `(session_id, transaction_id)` is unique |
| `investigations` | `start_account_id`, `dfs_traversal`, `suspicious_patterns` | JSON text columns for the saved DFS run and analysis counts |
| `findings` | `investigation_id`, `finding_type`, `severity`, `evidence` | `evidence` is JSON text, always populated |

Per-session uniqueness is deliberate: two workspaces can both hold `ACC1001`
without colliding, and Playwright workers never interfere with each other.

## Session lifecycle

1. `POST /api/sessions/bootstrap` creates a session row, seeds the demo dataset,
   and sets `traceledger_session` as an `HttpOnly`, `SameSite=Lax` cookie.
2. `GET /api/sessions/me` returns the workspace counts; it is the frontend's
   resume path when a cookie already exists.
3. A raw `X-Session-Token` header is accepted as a fallback for tests and
   non-browser clients; the cookie wins when both are present.
4. `POST /api/sessions/reset` re-seeds the same session.
5. `DELETE /api/sessions/` removes the workspace and clears the cookie.

The token is a UUID stored server-side with an expiry. It is never rendered into
the page HTML, never stored in `localStorage`, and cannot be read by JavaScript.

### First-load race

A visitor can open `/network` directly, before any cookie exists. Every request
therefore retries once after a single shared bootstrap when it receives a 401
(`frontend/src/lib/api.ts`). One in-flight bootstrap promise is reused so a page
that fires four requests in parallel still creates exactly one workspace.

## Frontend structure

```
frontend/src/
├── app/
│   ├── page.tsx                 # public landing page (terminal-style)
│   ├── (app)/layout.tsx         # session provider + app shell
│   └── (app)/{dashboard,accounts,transactions,investigations,network,reports,settings}/
├── components/
│   ├── ui/                      # hand-written shadcn-style primitives
│   ├── app-shell.tsx            # responsive sidebar + mobile drawer
│   ├── graph-canvas.tsx         # React Flow rendering, DFS highlighting
│   ├── session-provider.tsx     # bootstrap/resume/reset/delete context
│   └── shared.tsx               # PageHeader, StatCard, SeverityBadge, Money…
├── lib/api.ts                   # typed API client and error normalisation
├── lib/utils.ts                 # INR formatting, paise conversion, CSV export
└── types/index.ts               # shared API types
```

The UI is intentionally monochrome: white surfaces, zinc borders, a single dark
accent for the active state. Severity is communicated with text and density
rather than colour alone, so it survives greyscale printing.

## Detection pipeline

`DetectionService` runs five independent rule families:

| Rule | Trigger | Evidence |
| --- | --- | --- |
| Transaction chain | Simple directed path of 3–8 accounts | Account sequence, per-hop transactions, amounts |
| Circular flow | Directed cycle of 2–6 accounts | Cycle sequence and involved transfers |
| Rapid movement | ≥3 transfers touching an account inside 120 minutes | Account, count, window, totals |
| High value | Single transfer ≥ ₹1,00,000 | Amount, threshold, transaction ids |
| Intermediary | ≥2 distinct senders and ≥2 distinct receivers | Fan-in/fan-out counts and totals |

`GET /api/detection/summary` executes the same rules with `dry_run=True`, so the
dashboard can display counts without persisting duplicate findings. Only
`POST /api/investigations/{id}/analyze` writes findings and attaches them to an
investigation.

## Money handling

Amounts cross the wire and live in the database as integer paise. The only
conversion points are:

- `rupeesToPaise()` when a user types a rupee amount into a form,
- `formatINR()` when paise are displayed.

`TransactionCreate.amount` is validated with `gt=0`, and account balances are
stored as integers, so there is no floating-point drift anywhere in the money
path.

## Deployment topology

Recommended free-tier layout:

```
Render: Next.js web ── /api/* rewrite ──▶ Render: FastAPI web
        │                                        │
        └──────────── browser ───────────────────┘
                            SQLite (ephemeral) or Supabase Postgres
```

The same two-service shape works across providers (for example Vercel for the
frontend and Render for the API); `render.yaml` deploys both on Render so the
whole demo is one click and one URL. The `/api/*` rewrite keeps the session
cookie first-party, which avoids `SameSite=None` and third-party-cookie
blocking. `docs/api.md` documents the
environment variables. The backend is stateless apart from the database, so it
can be restarted without losing sessions as long as the database persists.

## Deliberate limitations

- No authentication beyond anonymous sessions: this is a teaching demo, not a
  banking system.
- Findings are heuristics, not verdicts. Every page repeats that framing.
- Graph state is rebuilt from the database per request. That keeps the demo
  simple and correct; a production system would cache or stream graph updates.
- `datetime.utcnow()` is used in a few places and emits deprecation warnings on
  Python 3.12+. Behaviour is correct; the migration to timezone-aware values is
  tracked in `docs/progress.md`.
