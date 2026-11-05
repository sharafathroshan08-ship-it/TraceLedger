# Graph and DFS

TraceLedger implements its graph by hand in `backend/app/graph.py`. No graph
library is imported: the adjacency list, traversal, cycle detection and
component analysis are all visible in one file.

## Model

- **Vertex** — a bank account, keyed by `account_number`.
- **Edge** — a transaction, directed `source → destination`.
- **Weight** — the amount in integer paise, carried on the edge payload.

Edges are directed because money leaves one account and arrives at another.
`ACC1001 → ACC1002` does not imply `ACC1002 → ACC1001`.

Parallel edges are allowed: two transfers between the same pair of accounts are
two transactions, but the adjacency list stores the neighbour once. The full
transaction list is preserved separately so every finding can cite real
transaction ids.

```
adjacency_list: { "ACC1001": ["ACC1002", "ACC1005", "ACC1003"], ... }
vertices:       { "ACC1001": GraphVertex(id, transactions, neighbors), ... }
transactions:   { "TX0001": Transaction(id, source, destination, amount, ts), ... }
```

## Operations and complexity

`V` = accounts, `E` = transactions, `deg(v)` = outgoing degree.

| Operation | Time | Space |
| --- | --- | --- |
| `add_account` | O(1) average | O(1) |
| `remove_account` | O(E) worst case (cascades edges) | O(1) |
| `add_transaction` | O(1) amortised | O(1) |
| `remove_transaction` | O(deg(source)) | O(1) |
| `find_neighbors` | O(deg(v)) | O(deg(v)) |
| `iterative_dfs` | O(V + E) | O(V) |
| `detect_cycles` | O(V + E) | O(V) |
| `get_connected_components` | O(V + E) | O(V + E) |

The graph is rebuilt from the database for each request
(`GraphService.sync_graph_from_session`). That is O(V + E) per request, which is
irrelevant at demo scale and keeps the in-memory graph impossible to desync.

## Iterative DFS

Recursion is avoided on purpose: a long transaction chain would risk Python's
recursion limit, and the stack makes the algorithm easier to narrate in a viva.

```python
def iterative_dfs(start_account):
    if start_account not in vertices:
        return [], []

    visited = set()
    traversal_order = []
    stack = [start_account]

    while stack:
        current = stack.pop()
        if current in visited:
            continue

        visited.add(current)
        traversal_order.append(current)

        for neighbor in reversed(adjacency_list.get(current, [])):
            if neighbor not in visited:
                stack.append(neighbor)

    return traversal_order, list(visited)
```

Three details matter:

1. **The visited check happens on pop, not on push.** A node can be pushed by
   several predecessors; skipping it on pop keeps the traversal linear.
2. **Neighbours are pushed in reverse.** A stack is LIFO, so reversing restores
   the adjacency-list order and makes the output deterministic. Two runs over
   the same data produce the same sequence, which is what the UI displays.
3. **The start account is marked visited before exploring.** That is what makes
   cycles terminate: the back edge to an already-visited node is ignored.

`find_reachable_accounts()` returns the discovery order rather than a set, so
the frontend can show a numbered chip sequence instead of an unordered list.

### Worked example

Starting at `ACC1001` with the demo dataset, the backend returns 13 accounts:

```
ACC1001 → ACC1002 → ACC1003 → ACC1010 → ACC1012 → ACC1013
        → ACC1011 → ACC1007 → ACC1008 → ACC1009 → ACC1006
        → ACC1004 → ACC1005
```

`ACC1014` and `ACC1015` never appear. They form their own two-account
component, so no directed path from `ACC1001` reaches them. This is the
distinction the UI keeps repeating: **unreachable by direction is not the same
as unrelated**.

## Cycle detection

Traversal alone does not prove a cycle, because a visited node can be reached by
many paths. `detect_cycles()` uses the three-colour DFS:

- **white (0)** — not visited,
- **grey (1)** — on the current recursion path,
- **black (2)** — fully explored.

An edge to a grey node closes a cycle. The cycle is the slice of the current
path starting at that node, plus the node again. A `frozenset` key deduplicates
rotations of the same cycle, and cycles shorter than three vertices are ignored.

The demo contains `ACC1011 → ACC1012 → ACC1013 → ACC1011` and
`ACC1014 → ACC1015 → ACC1014`; both are reported in `/network`.

## Weakly connected components

For structural display, edges are treated as undirected. A stack walk over the
undirected view yields the "islands" shown in the Network sidebar:

- the main component with `ACC1001`–`ACC1013`,
- the isolated pair `ACC1014` / `ACC1015`.

Weak components answer "which accounts belong to the same island?". DFS answers
"which accounts can this account actually send money to?". Both are shown, but
they are never conflated.

## Why not NetworkX

The assignment is about implementing the data structure and the algorithm. A
library call would hide exactly the part being assessed: adjacency-list design,
explicit stack handling, visited-set discipline, and complexity reasoning.
Every operation that a library would provide is implemented and tested locally.

## Tests that pin the behaviour

`backend/tests/test_graph.py` covers account and transaction lifecycle, edge
removal, DFS order, cycles, disconnected components, and traversal from a
missing account. See `docs/testing.md` for the full inventory.
