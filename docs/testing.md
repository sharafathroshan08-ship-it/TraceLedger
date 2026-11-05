# Testing

Two suites cover the project: Pytest for backend behaviour and Playwright for
the real browser flow. There are no frontend unit tests; the app's behaviour is
DOM-driven and is exercised end to end instead.

## Backend — Pytest

```bash
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

`tests/conftest.py` creates a temporary SQLite database per test module and
overrides the `get_db` dependency, so the developer database and the demo file
are never touched.

| File | Focus |
| --- | --- |
| `tests/test_graph.py` | Adjacency list, add/remove account and edge, DFS order, cycles, disconnected components, missing start vertex |
| `tests/test_api.py` | Session bootstrap, account CRUD, transaction validation and balance reversal, DFS endpoint, all five detectors, investigation workflow, report generation, reset |
| `tests/test_session_isolation.py` | A token cannot read or mutate another workspace's accounts, transactions, investigations or findings |

Notable assertions:

- amounts are rejected when zero or negative,
- a transaction cannot be created from an account in another session,
- deleting an account removes its edges,
- DFS from `ACC1001` returns 13 accounts and excludes `ACC1014`/`ACC1015`,
- cycle detection finds the `ACC1011 → ACC1012 → ACC1013 → ACC1011` loop,
- the high-value rule marks the ₹5,00,000 transfer `critical`,
- `GET /api/detection/summary` does not grow the findings table.

Latest local run: **30 passed** (Python 3.15, ~1.3 s). The only output is
`datetime.utcnow()` deprecation warnings from Python 3.12+; they are tracked in
`docs/progress.md` and do not affect results.

## Frontend — Playwright

```bash
cd frontend
npm.cmd run test:e2e        # Windows PowerShell
npm run test:e2e            # macOS / Linux / Git Bash
```

Prerequisites:

1. FastAPI running on `http://localhost:8000`.
2. Dependencies installed (`npm install`, `pip install -r requirements.txt`).

`playwright.config.ts` starts the Next.js dev server automatically and reuses an
existing one. It defaults to the locally installed **Microsoft Edge** channel on
Windows so no browser download is required; elsewhere set
`PLAYWRIGHT_CHANNEL=chromium` after `npx playwright install chromium`, or leave
it empty to use Playwright's bundled browser.

Each test runs in a fresh browser context, which means a fresh HttpOnly cookie
and a fresh seeded workspace. Tests never share state, and the reset test cannot
disturb another spec.

| Spec | What it proves |
| --- | --- |
| Landing → dashboard | The CTA bootstraps a workspace and the dashboard shows seeded counts |
| Accounts | Create, search, delete; clearing the search restores the seed |
| Transactions | Create a directed transfer, see correct INR formatting, delete reverses it |
| Investigation | Runs real DFS, shows 13 visited accounts, lists findings, opens the report, downloads the findings CSV |
| Network | React Flow renders 15 nodes, DFS highlights a traversal, node inspector opens |
| Settings | Reset restores the demo dataset |
| Mobile | At 390×844 the navigation drawer opens and exposes all links |

Latest local run: **7 passed** (~11 s).

### Deep-link regression

The first version of the frontend issued four requests in parallel on a direct
visit to `/accounts`, before any cookie existed. All four returned `401`, and
each could create its own workspace. `lib/api.ts` now shares one in-flight
`bootstrapOnce()` promise and retries the failed request, so parallel requests
produce exactly one session. Direct navigation to `/accounts`, `/transactions`,
`/network` and `/settings` is part of the manual smoke check.

## Manual smoke checklist

1. Open `/` in a private window; click **Enter the demo**.
2. Visit each of the eight pages directly by URL (no navigation) — all must
   load seeded data, not an empty state.
3. On `/network`, run DFS from `ACC1001`: 13 chips, two dark components in the
   sidebar, cycle list showing both loops.
4. On `/investigations`, run an investigation; confirm `high` findings for the
   chain and cycle, `critical` for the high-value transfer.
5. Open the report, print preview it, and export both CSVs.
6. In `/settings`, reset, then delete the workspace; confirm the landing page
   creates a fresh one on the next visit.
7. Resize to 390 px wide and confirm the drawer, tables and graph remain usable.

## What is not covered

- No CI workflow yet; both suites are run locally.
- No accessibility automation (axe) or visual-regression snapshots.
- No load or concurrency tests beyond session isolation.
- The browser MCP integration in this environment needs Chrome installed; the
  Playwright CLI suite with Edge is the supported path.
