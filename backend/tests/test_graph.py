"""Unit tests for the hand-written Graph and iterative DFS."""

import pytest

from app.graph import Graph, Transaction


def make_tx(tx_id: str, src: str, dst: str, amount: int = 1000) -> Transaction:
    return Transaction(
        transaction_id=tx_id,
        source_account=src,
        destination_account=dst,
        amount=amount,
        timestamp=0.0,
    )


def build_sample_graph() -> Graph:
    g = Graph()
    for account in ["A", "B", "C", "D"]:
        assert g.add_account(account)
    g.add_transaction(make_tx("t1", "A", "B"))
    g.add_transaction(make_tx("t2", "B", "C"))
    g.add_transaction(make_tx("t3", "C", "A"))
    g.add_transaction(make_tx("t4", "C", "D"))
    return g


def test_add_duplicate_account_returns_false():
    g = Graph()
    assert g.add_account("A") is True
    assert g.add_account("A") is False
    assert g.get_account_count() == 1


def test_add_transaction_requires_existing_accounts():
    g = Graph()
    g.add_account("A")
    assert g.add_transaction(make_tx("t1", "A", "Z")) is False
    assert g.get_transaction_count() == 0


def test_add_transaction_creates_directed_edge():
    g = build_sample_graph()
    assert "B" in g.find_neighbors("A")
    # Direction matters: B received from A but did not send to A.
    assert "A" not in g.find_neighbors("B")
    assert "C" in g.find_neighbors("B")
    assert g.get_transaction_count() == 4


def test_search_account():
    g = build_sample_graph()
    assert g.search_account("C") is not None
    assert g.search_account("missing") is None


def test_dfs_visits_all_reachable_nodes_once():
    g = build_sample_graph()
    order, visited = g.iterative_dfs("A")
    assert set(order) == {"A", "B", "C", "D"}
    assert len(order) == len(set(order)), "DFS must not repeat accounts"


def test_dfs_handles_cycles():
    g = build_sample_graph()  # contains A -> B -> C -> A
    order, _ = g.iterative_dfs("A")
    assert set(order) == {"A", "B", "C", "D"}


def test_dfs_handles_disconnected_accounts():
    g = build_sample_graph()
    g.add_account("Z")  # isolated vertex
    assert g.find_reachable_accounts("A") == ["A", "B", "C", "D"]
    assert g.find_reachable_accounts("Z") == ["Z"]
    assert g.is_connected() is False
    components = g.get_connected_components()
    assert len(components) == 2


def test_dfs_from_missing_vertex_returns_empty():
    g = build_sample_graph()
    order, visited = g.iterative_dfs("does-not-exist")
    assert order == []
    assert visited == []


def test_remove_transaction_cleans_adjacency():
    g = build_sample_graph()
    assert g.remove_transaction("t4") is True
    assert "D" not in g.find_neighbors("C")
    assert g.get_transaction_count() == 3
    assert g.remove_transaction("t4") is False


def test_remove_account_removes_related_transactions():
    g = build_sample_graph()
    assert g.remove_account("C") is True
    # t2 (B->C), t3 (C->A), t4 (C->D) must all be gone
    assert g.get_transaction_count() == 1
    assert g.search_account("C") is None
    assert "C" not in g.find_neighbors("B")


def test_detect_cycles_finds_the_abc_cycle():
    g = build_sample_graph()
    cycles = g.detect_cycles()
    flattened = {frozenset(cycle) for cycle in cycles}
    assert frozenset({"A", "B", "C"}) in flattened


def test_dfs_time_and_space_complexity_shape():
    """Guard the documented complexity: DFS returns each reachable node once."""
    g = Graph()
    for i in range(50):
        g.add_account(f"N{i}")
    for i in range(49):
        g.add_transaction(make_tx(f"e{i}", f"N{i}", f"N{i + 1}"))
    order, _ = g.iterative_dfs("N0")
    assert len(order) == 50
