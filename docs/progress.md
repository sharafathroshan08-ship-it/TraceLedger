# Progress

Last updated: 2026-11-05.

## Status summary

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Backend foundation: models, schemas, database, session auth | Complete |
| 2 | Hand-written directed graph and iterative DFS | Complete |
| 3 | Five detection rules with evidence | Complete |
| 4 | Demo dataset, seed and reset | Complete |
| 5 | REST API: accounts, transactions, graph, detection, investigations | Complete |
| 6 | Frontend shell, design system, landing page | Complete |
| 7 | Eight application pages and graph canvas | Complete |
| 8 | Backend tests (Pytest) | Complete — 30 passed |
| 9 | Browser tests (Playwright) | Complete — 7 passed |
| 10 | Production build | Complete — 11 routes |
| 11 | Documentation | Complete |
| 12 | Deployment hardening (cookie flags, same-origin proxy, one-click Render blueprint) | Complete; live instance not yet provisioned (owner login required) |

## What exists

### Backend

- `app/graph.py` — adjacency list, iterative DFS, cycle detection with DFS
  colours, weak components. No graph library.
- `app/database.py` — SQLAlchemy models with per-session uniqueness on account
  number and transaction id.
- `app/dependencies.py` — HttpOnly cookie session resolution with header
  fallback, 24-hour expiry, env-driven `Secure` flag.
- `app/services/` — account, transaction, graph, session, investigation and
  detection services. Every query is scoped by `session_id`.
- `app/demo_data.py` — 15 accounts, 28 transactions, five pattern families and
  a disconnected pair.
- `app/routers/` — 6 routers covering sessions, accounts, transactions, graph,
  detection and investigations.
- `tests/` — 30 tests across graph behaviour, API behaviour and session
  isolation.

### Frontend

- Next.js 15 App Router, React 19, TypeScript, Tailwind v3.
- Hand-written shadcn-style primitives in `components/ui` (no Radix runtime).
- `/`, `/dashboard`, `/accounts`, `/transactions`, `/investigations`,
  `/network`, `/reports`, `/settings` — no additional pages.
- React Flow canvas with custom account nodes, directed edges, DFS
  highlighting, minimap, node and edge inspectors.
- Reports with print layout and two CSV exports.
- Auto-bootstrap and single-retry API client so deep links work on first visit.
- Responsive shell with mobile drawer; monochrome design consistently applied.

## Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| Backend tests | `..\.venv\Scripts\python.exe -m pytest -q` (in `backend`) | 30 passed |
| Production build | `npm.cmd run build` (in `frontend`) | 11 routes, compiled with no type errors |
| Browser tests | `npm.cmd run test:e2e` (in `frontend`) | 7 passed |
| Deep links | Manual: open `/accounts`, `/transactions`, `/network`, `/settings` directly | Seeded data loads, one workspace created |
| API health | `GET http://127.0.0.1:8000/api/health` | 200 `healthy` |

## Issues found and fixed during the build

1. **Chain detector reported only 3-node prefixes.** Rewritten to record maximal
   simple paths (length 3–8, capped at 20 findings), with `high` severity at
   length ≥ 5. This is what makes the long layered path visible in the UI.
2. **First-load 401 race.** Parallel requests on a direct deep link each tried
   to bootstrap. Fixed with one shared in-flight bootstrap promise plus a retry.
3. **Dashboard would have persisted duplicate findings.** The dashboard counts
   now come from `GET /api/detection/summary`, which runs the detectors with
   `dry_run=True`.
4. **Playwright locator collisions.** Several specs matched both a chart label
   and a heading, or an `<option>` and a chip. Fixed with `exact`, scoped
   locators, and a `data-testid` on the DFS traversal strip.
5. **Cross-site cookie problem in production.** The frontend now supports a
   same-origin `/api/*` rewrite to the backend, and the cookie's `Secure` flag is
   controlled by `TRACELEDGER_COOKIE_SECURE`.

## Known issues and limitations

- **Python 3.12+ deprecation warnings.** `datetime.utcnow()` is used in several
  models and services. Results are correct; migrating to
  `datetime.now(datetime.UTC)` is a mechanical follow-up.
- **SQLite is single-file.** Fine for a demo and Render's free tier with a
  persistent disk, not for concurrent production use. The Postgres switch is
  one environment variable, but no migration covers existing SQLite data.
- **No authentication.** Workspaces are anonymous by design; there is no login,
  password reset, or cross-device resume.
- **No CI.** Both suites are local. A GitHub Actions workflow is the obvious
  next step.
- **OneDrive and `.next`.** On this machine, changing `next.config.ts` while the
  dev server runs occasionally triggers `EINVAL: readlink` on
  `.next/app-path-routes-manifest.json`. Deleting `.next` and restarting the dev
  server resolves it; it is an OneDrive filesystem artefact, not an app bug.
- **Playwright MCP needs Chrome.** The built-in browser tooling looks for
  Chrome, which is not installed here. The suite uses the Edge channel through
  the Playwright CLI instead.
- **No deployment has been executed.** `render.yaml` deploys both services from
  one Blueprint, and the two-service topology was verified locally (rewrite,
  `Set-Cookie` forwarding, session isolation), but no live URL exists yet
  because the hosting accounts require the owner's login.

## Next steps

1. Run the Render Blueprint deploy (or Vercel + Render), then smoke-test the
   eight routes and cookie persistence on the live URL.
2. Add a GitHub Actions workflow running Pytest and the Playwright suite
   (chromium) on pull requests.
3. Replace `datetime.utcnow()` with timezone-aware timestamps.
4. Add axe-core accessibility checks and a visual snapshot of the graph page.
5. Decide whether investigation deletion should cascade findings explicitly in
   the ORM instead of service-level cleanup.
