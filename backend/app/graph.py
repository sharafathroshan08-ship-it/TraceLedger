"""
Hand-written directed graph for TraceLedger.

Accounts are vertices, transactions are directed edges (source -> destination).
Nothing here uses a graph library: the adjacency list, DFS and neighbour
lookups are implemented directly so the algorithm can be explained in a viva.

Complexities (V = accounts, E = transactions):
  * add / remove account            O(1) average, plus O(E) when cascading
  * add / remove transaction        O(1) adjacency update, O(deg) cleanup
  * iterative DFS                   O(V + E) time, O(V) space
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict


@dataclass
class Transaction:
    """A directed money movement between two accounts."""

    transaction_id: str
    source_account: str
    destination_account: str
    amount: int
    timestamp: float


@dataclass
class GraphVertex:
    """Vertex payload for an account."""

    id: str
    transactions: List[Transaction]
    neighbors: List[str]


class Graph:
    """Directed graph backed by an adjacency list."""

    def __init__(self) -> None:
        self.adjacency_list: Dict[str, List[str]] = defaultdict(list)
        self.vertices: Dict[str, GraphVertex] = {}
        self.transactions: Dict[str, Transaction] = {}
        self.account_to_transactions: Dict[str, List[str]] = defaultdict(list)
        self.transaction_to_accounts: Dict[str, Tuple[str, str]] = {}

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------
    def add_account(self, account_id: str) -> bool:
        """Add a vertex. Returns False if it already exists."""
        if account_id in self.vertices:
            return False
        self.vertices[account_id] = GraphVertex(id=account_id, transactions=[], neighbors=[])
        self.adjacency_list.setdefault(account_id, [])
        return True

    def remove_account(self, account_id: str) -> bool:
        """Remove a vertex, every edge touching it, and its transactions."""
        if account_id not in self.vertices:
            return False

        # Copy because remove_transaction mutates the backing lists.
        for trans_id in list(self.account_to_transactions.get(account_id, [])):
            self.remove_transaction(trans_id)

        # Drop incoming edges from other vertices.
        for other in list(self.adjacency_list.keys()):
            if account_id in self.adjacency_list[other]:
                self.adjacency_list[other] = [
                    n for n in self.adjacency_list[other] if n != account_id
                ]

        self.adjacency_list.pop(account_id, None)
        self.account_to_transactions.pop(account_id, None)
        del self.vertices[account_id]
        return True

    # ------------------------------------------------------------------
    # Transactions
    # ------------------------------------------------------------------
    def add_transaction(self, transaction: Transaction) -> bool:
        """Add a directed edge. Both endpoints must already exist."""
        source = transaction.source_account
        dest = transaction.destination_account
        if source not in self.vertices or dest not in self.vertices:
            return False
        if source == dest:
            return False

        if dest not in self.adjacency_list[source]:
            self.adjacency_list[source].append(dest)

        self.vertices[source].transactions.append(transaction)
        self.vertices[dest].transactions.append(transaction)

        self.account_to_transactions[source].append(transaction.transaction_id)
        self.account_to_transactions[dest].append(transaction.transaction_id)
        self.transaction_to_accounts[transaction.transaction_id] = (source, dest)
        self.transactions[transaction.transaction_id] = transaction
        return True

    def remove_transaction(self, transaction_id: str) -> bool:
        """Remove an edge and its metadata."""
        if transaction_id not in self.transactions:
            return False

        transaction = self.transactions[transaction_id]
        source = transaction.source_account
        dest = transaction.destination_account

        self.vertices[source].transactions = [
            t for t in self.vertices[source].transactions if t.transaction_id != transaction_id
        ]
        self.vertices[dest].transactions = [
            t for t in self.vertices[dest].transactions if t.transaction_id != transaction_id
        ]

        if transaction_id in self.account_to_transactions[source]:
            self.account_to_transactions[source].remove(transaction_id)
        if transaction_id in self.account_to_transactions[dest]:
            self.account_to_transactions[dest].remove(transaction_id)

        # Keep the adjacency entry only if another transaction still connects them.
        still_connected = any(
            t.source_account == source and t.destination_account == dest
            for t in self.vertices[source].transactions
        )
        if not still_connected and dest in self.adjacency_list[source]:
            self.adjacency_list[source].remove(dest)

        del self.transaction_to_accounts[transaction_id]
        del self.transactions[transaction_id]
        return True

    # ------------------------------------------------------------------
    # Lookups
    # ------------------------------------------------------------------
    def search_account(self, account_id: str) -> Optional[GraphVertex]:
        return self.vertices.get(account_id)

    def find_neighbors(self, account_id: str) -> List[str]:
        """Outgoing neighbours (accounts that received money from this one)."""
        return list(self.adjacency_list.get(account_id, []))

    def get_account_transactions(self, account_id: str) -> List[Transaction]:
        vertex = self.vertices.get(account_id)
        return list(vertex.transactions) if vertex else []

    def get_adjacency_list(self) -> Dict[str, List[str]]:
        return {k: list(v) for k, v in self.adjacency_list.items()}

    def get_account_count(self) -> int:
        return len(self.vertices)

    def get_transaction_count(self) -> int:
        return len(self.transactions)

    # ------------------------------------------------------------------
    # DFS
    # ------------------------------------------------------------------
    def iterative_dfs(self, start_account: str) -> Tuple[List[str], List[str]]:
        """
        Iterative depth-first search over directed edges.

        Uses an explicit stack, a visited set and the adjacency list:
          1. push the start account
          2. pop a node; if unvisited, mark it and record it
          3. push its unvisited neighbours (reversed for natural order)

        Returns (traversal_order, visited_accounts).
        Time  O(V + E)
        Space O(V)
        """
        if start_account not in self.vertices:
            return [], []

        visited: Set[str] = set()
        traversal_order: List[str] = []
        stack: List[str] = [start_account]

        while stack:
            current = stack.pop()
            if current in visited:
                continue

            visited.add(current)
            traversal_order.append(current)

            for neighbor in reversed(self.adjacency_list.get(current, [])):
                if neighbor not in visited:
                    stack.append(neighbor)

        return traversal_order, list(visited)

    def find_reachable_accounts(self, start_account: str) -> List[str]:
        """
        Every account reachable by following outgoing transactions.

        Returns them in DFS discovery order so the result is deterministic
        and can be shown directly in the UI.
        """
        traversal_order, _ = self.iterative_dfs(start_account)
        return traversal_order

    # ------------------------------------------------------------------
    # Graph-level analysis
    # ------------------------------------------------------------------
    def detect_cycles(self) -> List[List[str]]:
        """
        Detect directed cycles using DFS colours (white / grey / black).

        A back edge to a grey node closes a cycle. Only *non-trivial* cycles
        (two or more distinct accounts) are returned.
        """
        cycles: List[List[str]] = []
        seen: Set[frozenset] = set()
        color: Dict[str, int] = {vertex: 0 for vertex in self.vertices}  # 0 white, 1 grey, 2 black

        def dfs(node: str, path: List[str]) -> None:
            color[node] = 1
            path.append(node)

            for neighbor in self.adjacency_list.get(node, []):
                if color.get(neighbor, 0) == 1:
                    start = path.index(neighbor)
                    cycle = path[start:] + [neighbor]
                    key = frozenset(cycle)
                    if neighbor != node and key not in seen and len(cycle) > 2:
                        seen.add(key)
                        cycles.append(cycle)
                elif color.get(neighbor, 0) == 0:
                    dfs(neighbor, path)

            path.pop()
            color[node] = 2

        for vertex in self.vertices:
            if color[vertex] == 0:
                dfs(vertex, [])

        return cycles

    def is_connected(self) -> bool:
        """
        True when every account is reachable from any one account following
        directed edges. For a directed graph this is the reachability view.
        """
        if not self.vertices:
            return True
        start = next(iter(self.vertices))
        return len(self.find_reachable_accounts(start)) == len(self.vertices)

    def get_connected_components(self) -> List[List[str]]:
        """
        Return weakly connected components (edges treated as undirected).

        Useful for showing disconnected islands in the UI, while DFS itself
        still respects transaction direction.
        """
        undirected: Dict[str, Set[str]] = {v: set() for v in self.vertices}
        for source, targets in self.adjacency_list.items():
            for target in targets:
                undirected[source].add(target)
                undirected[target].add(source)

        visited: Set[str] = set()
        components: List[List[str]] = []

        for vertex in self.vertices:
            if vertex in visited:
                continue
            stack = [vertex]
            component: List[str] = []
            while stack:
                node = stack.pop()
                if node in visited:
                    continue
                visited.add(node)
                component.append(node)
                stack.extend(undirected[node] - visited)
            components.append(component)

        return components
