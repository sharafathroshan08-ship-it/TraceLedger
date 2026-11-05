# API reference

Base URL in development: `http://localhost:8000`.
Interactive schema: `GET /docs` (Swagger UI) and `GET /openapi.json`.

## Authentication

Every endpoint except the health check requires a workspace session.

```
POST /api/sessions/bootstrap      → 201, sets Set-Cookie: traceledger_session
GET  /api/sessions/me             → 200, workspace counts
```

The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, valid for 24 hours. The
frontend sends `credentials: "include"` on every request. Non-browser clients
may send `X-Session-Token: <session-id>` instead of the cookie; the cookie wins
when both are present.

Missing or expired token:

```json
{ "detail": "No active session. Call /api/sessions/bootstrap first." }
```

with status `401`. A token that belongs to a deleted or expired session returns
`401` with `"Session expired or invalid."`.

## Money

All amounts are integer **paise** (1 rupee = 100 paise) in both directions.
`amount` must be `> 0`; account `balance` must be `>= 0`. There are no floats in
the API contract.

## Endpoints

### Sessions

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/sessions/bootstrap` | Create workspace, seed demo data, issue cookie |
| `GET` | `/api/sessions/me` | Current session id + account/transaction/investigation counts |
| `POST` | `/api/sessions/reset` | Re-seed the demo dataset in place |
| `DELETE` | `/api/sessions/` | Delete the workspace and clear the cookie |

### Accounts

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/accounts/` | Create account (`account_number`, `account_holder`, `balance`) |
| `GET` | `/api/accounts/?q=&limit=&offset=` | List/search; `q` matches number or holder; `limit` capped at 200 |
| `GET` | `/api/accounts/search?number=ACC1001` | Exact account-number lookup |
| `GET` | `/api/accounts/{id}` | Fetch one account |
| `PUT` | `/api/accounts/{id}` | Update holder, balance or active flag |
| `GET` | `/api/accounts/{id}/neighbors` | Directly connected accounts via the graph |
| `DELETE` | `/api/accounts/{id}` | Delete account **and** every transaction touching it |

### Transactions

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/transactions/` | Create a directed edge |
| `GET` | `/api/transactions/?limit=&offset=` | List transfers for the workspace |
| `GET` | `/api/transactions/{id}` | Fetch one transfer |
| `PUT` | `/api/transactions/{id}` | Update description / fraud flag |
| `DELETE` | `/api/transactions/{id}` | Delete transfer and reverse balances |

Create payload:

```json
{
  "source_account_id": 1,
  "destination_account_id": 2,
  "amount": 250000,
  "transaction_type": "transfer",
  "description": "Vendor settlement"
}
```

`amount: 250000` is ₹2,500.00. Source and destination must differ, belong to
the current session, and the source balance must cover the amount.

### Graph

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/graph/` | Accounts, transactions, adjacency list and stats |
| `POST` | `/api/graph/dfs/{start_account}` | Run iterative DFS from an account number |
| `GET` | `/api/graph/components` | Weakly connected components |
| `GET` | `/api/graph/cycles` | Directed cycles |
| `GET` | `/api/graph/is-connected` | Directed reachability from one vertex to all |
| `GET` | `/api/graph/neighbors/{account_number}` | Outgoing neighbours |
| `GET` | `/api/graph/reachable/{start_account}` | Reachable accounts in DFS order |

DFS response:

```json
{
  "start_account": "ACC1001",
  "traversal_order": ["ACC1001", "ACC1002", "ACC1003", "…"],
  "visited": ["ACC1001", "ACC1002", "ACC1003", "…"],
  "adjacency_list": { "ACC1001": ["ACC1002", "ACC1005", "ACC1003"] },
  "time_complexity": "O(V + E)",
  "space_complexity": "O(V)"
}
```

`traversal_order` is the DFS discovery order and is deterministic. `visited` is
the same set rendered as a list for clients that only need membership.

### Detection

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/detection/summary` | Counts by severity/type, **no writes** (`dry_run`) |
| `POST` | `/api/detection/analyze` | Run all five rules and persist findings |
| `POST` | `/api/detection/patterns/transaction-chain` | Chains only (`min_length=3`) |
| `POST` | `/api/detection/patterns/circular` | Cycles only (`max_cycle_length=6`) |
| `POST` | `/api/detection/patterns/rapid-movement` | Rapid movement (`time_window_minutes=120`, `min_transactions=3`) |
| `POST` | `/api/detection/patterns/high-value` | High value (`min_amount` in paise, default ₹1,00,000) |
| `POST` | `/api/detection/patterns/intermediary` | Intermediary (`min_receivers=2`, `min_distributors=2`) |
| `POST` | `/api/detection/findings` | Create a manual finding |
| `GET` | `/api/detection/findings/{id}` | Fetch one finding |

Severities are `low`, `medium`, `high`, `critical`. Every finding includes an
`evidence` object; examples:

```json
{
  "chain": ["ACC1001", "ACC1002", "ACC1003"],
  "involved_transactions": ["TX0001", "TX0002"]
}
```

```json
{
  "account_number": "ACC1008",
  "amount_paise": 50000000,
  "threshold_paise": 10000000
}
```

### Investigations

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/investigations/` | Start an investigation at `start_account_id` |
| `GET` | `/api/investigations/` | History for this workspace |
| `GET` | `/api/investigations/{id}` | One investigation, including saved DFS |
| `POST` | `/api/investigations/{id}/run-dfs` | Execute and store DFS from the start account |
| `POST` | `/api/investigations/{id}/analyze` | Run detectors, attach findings, store summary |
| `GET` | `/api/investigations/{id}/findings` | Findings attached to the investigation |
| `GET` | `/api/investigations/{id}/report` | Structured report JSON (account, DFS, summaries, findings) |
| `DELETE` | `/api/investigations/{id}` | Delete investigation and its findings |

`run-dfs` and `analyze` are separate so the UI can show traversal and findings
independently, and so a report can still be generated for an investigation that
was only partially executed.

### Health

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/` or `/api/health` | `{ "status": "healthy", "service": "TraceLedger API", … }` |

## Error shape

FastAPI's standard envelope is used throughout:

```json
{ "detail": "Account not found: 42" }
```

Validation errors return `422` with a list in `detail`; the frontend flattens
the first messages into a visible banner.

## Environment variables

| Variable | Default | Applies to |
| --- | --- | --- |
| `TRACELEDGER_DATABASE_URL` | `sqlite:///./traceledger.db` | Backend; set to a Postgres URL for Supabase |
| `TRACELEDGER_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Backend CORS, comma separated |
| `TRACELEDGER_COOKIE_SECURE` | unset (false) | Backend; set `true` on HTTPS so the cookie is `Secure` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Frontend; empty string means same-origin `/api` |
| `TRACELEDGER_API_PROXY` | unset | Frontend server; proxies `/api/*` to this backend origin |

`NEXT_PUBLIC_*` values are inlined at build time, so change them before
`npm run build` on Vercel. `TRACELEDGER_API_PROXY` is read at runtime by the
Next.js server.

## curl walkthrough

```bash
# 1. create a workspace and keep the cookie
curl -c cookies.txt -X POST http://localhost:8000/api/sessions/bootstrap

# 2. list the seeded accounts
curl -b cookies.txt "http://localhost:8000/api/accounts/?limit=200"

# 3. run DFS from the first account
curl -b cookies.txt -X POST http://localhost:8000/api/graph/dfs/ACC1001

# 4. execute an investigation
curl -b cookies.txt -X POST http://localhost:8000/api/investigations/ \
  -H "Content-Type: application/json" -d '{"start_account_id": 1}'
curl -b cookies.txt -X POST http://localhost:8000/api/investigations/1/run-dfs
curl -b cookies.txt -X POST http://localhost:8000/api/investigations/1/analyze
curl -b cookies.txt http://localhost:8000/api/investigations/1/report
```
