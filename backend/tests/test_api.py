"""End-to-end API tests against the FastAPI app with a real SQLite database."""


def get_accounts(client):
    response = client.get("/api/accounts/?limit=100")
    assert response.status_code == 200, response.text
    return response.json()


def account_by_number(client, number):
    return next((a for a in get_accounts(client) if a["account_number"] == number), None)


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_bootstrap_creates_demo_workspace(client):
    response = client.post("/api/sessions/bootstrap")
    assert response.status_code == 201
    body = response.json()
    assert body["accounts_count"] == 15
    assert body["transactions_count"] == 28

    me = client.get("/api/sessions/me")
    assert me.status_code == 200
    assert me.json()["id"] == body["id"]


def test_unauthenticated_requests_are_rejected(client):
    # No bootstrap on this fresh client, so no cookie exists.
    assert client.get("/api/accounts/").status_code == 401
    assert client.get("/api/transactions/").status_code == 401


def test_account_crud(bootstrapped):
    client = bootstrapped
    payload = {"account_number": "ACC9001", "account_holder": "Test User", "balance": 500000}
    created = client.post("/api/accounts/", json=payload)
    assert created.status_code == 201, created.text
    account = created.json()
    assert account["account_number"] == "ACC9001"
    assert account["balance"] == 500000

    # Search by exact number
    found = client.get("/api/accounts/search", params={"number": "ACC9001"})
    assert found.status_code == 200
    assert found.json()["id"] == account["id"]

    # Update holder
    updated = client.put(f"/api/accounts/{account['id']}", json={"account_holder": "Renamed User"})
    assert updated.status_code == 200
    assert updated.json()["account_holder"] == "Renamed User"

    # Delete
    deleted = client.delete(f"/api/accounts/{account['id']}")
    assert deleted.status_code == 200
    assert client.get(f"/api/accounts/{account['id']}").status_code == 404


def test_account_validation_rejects_bad_input(bootstrapped):
    client = bootstrapped
    bad = {"account_number": "!!", "account_holder": "X", "balance": 0}
    assert client.post("/api/accounts/", json=bad).status_code == 422
    duplicate = {"account_number": "ACC1001", "account_holder": "Duplicate", "balance": 0}
    assert client.post("/api/accounts/", json=duplicate).status_code == 400


def test_transaction_crud_and_balance_updates(bootstrapped):
    client = bootstrapped
    source = account_by_number(client, "ACC1001")
    destination = account_by_number(client, "ACC1002")
    start_source_balance = source["balance"]

    payload = {
        "source_account_id": source["id"],
        "destination_account_id": destination["id"],
        "amount": 100000,
        "transaction_type": "transfer",
        "description": "pytest transfer",
    }
    created = client.post("/api/transactions/", json=payload)
    assert created.status_code == 201, created.text
    tx = created.json()
    assert tx["amount"] == 100000

    refreshed = client.get(f"/api/accounts/{source['id']}").json()
    assert refreshed["balance"] == start_source_balance - 100000

    # Delete reverses the balance change.
    assert client.delete(f"/api/transactions/{tx['id']}").status_code == 200
    restored = client.get(f"/api/accounts/{source['id']}").json()
    assert restored["balance"] == start_source_balance


def test_transaction_validation(bootstrapped):
    client = bootstrapped
    source = account_by_number(client, "ACC1001")
    destination = account_by_number(client, "ACC1002")

    for amount in (0, -500):
        response = client.post(
            "/api/transactions/",
            json={
                "source_account_id": source["id"],
                "destination_account_id": destination["id"],
                "amount": amount,
            },
        )
        assert response.status_code == 422

    same_account = client.post(
        "/api/transactions/",
        json={
            "source_account_id": source["id"],
            "destination_account_id": source["id"],
            "amount": 100,
        },
    )
    assert same_account.status_code == 400

    too_much = client.post(
        "/api/transactions/",
        json={
            "source_account_id": source["id"],
            "destination_account_id": destination["id"],
            "amount": 10**12,
        },
    )
    assert too_much.status_code == 400


def test_graph_endpoint_returns_real_data(bootstrapped):
    client = bootstrapped
    response = client.get("/api/graph/")
    assert response.status_code == 200
    body = response.json()
    assert len(body["accounts"]) == 15
    assert len(body["transactions"]) == 28
    assert body["adjacency_list"]["ACC1001"]


def test_dfs_endpoint_returns_real_traversal(bootstrapped):
    client = bootstrapped
    response = client.post("/api/graph/dfs/ACC1001")
    assert response.status_code == 200
    body = response.json()
    assert body["traversal_order"][0] == "ACC1001"
    # 13 accounts belong to the main component; 1014/1015 are disconnected.
    assert len(body["traversal_order"]) == 13
    assert "ACC1014" not in body["traversal_order"]
    assert body["time_complexity"] == "O(V + E)"


def test_dfs_missing_account_returns_404(bootstrapped):
    client = bootstrapped
    assert client.post("/api/graph/dfs/NOPE999").status_code == 404


def test_connected_components_and_cycles(bootstrapped):
    client = bootstrapped
    components = client.get("/api/graph/components").json()
    assert len(components) == 2
    assert any(set(c) == {"ACC1014", "ACC1015"} for c in components)

    cycles = client.get("/api/graph/cycles").json()
    flattened = {frozenset(c) for c in cycles}
    assert frozenset({"ACC1011", "ACC1012", "ACC1013"}) in flattened


def test_detection_finds_all_rule_families(bootstrapped):
    client = bootstrapped
    response = client.post("/api/detection/analyze")
    assert response.status_code == 200
    findings = response.json()
    types = {f["finding_type"] for f in findings}
    assert "transaction_chain" in types
    assert "circular_transaction" in types
    assert "rapid_movement" in types
    assert "high_value_transfer" in types
    assert "suspicious_intermediary" in types

    # Severities must stay within the documented vocabulary.
    assert {f["severity"] for f in findings} <= {"low", "medium", "high", "critical"}
    # Every finding carries evidence.
    assert all(f["evidence"] for f in findings)


def test_high_value_threshold_is_configurable(bootstrapped):
    client = bootstrapped
    response = client.post(
        "/api/detection/patterns/high-value", params={"min_amount": 10**12}
    )
    assert response.status_code == 200
    assert response.json() == []


def test_investigation_workflow(bootstrapped):
    client = bootstrapped
    start = account_by_number(client, "ACC1001")

    created = client.post("/api/investigations/", json={"start_account_id": start["id"]})
    assert created.status_code == 201, created.text
    investigation_id = created.json()["id"]

    dfs = client.post(f"/api/investigations/{investigation_id}/run-dfs")
    assert dfs.status_code == 200
    assert dfs.json()["traversal_order"][0] == "ACC1001"

    analysis = client.post(f"/api/investigations/{investigation_id}/analyze")
    assert analysis.status_code == 200
    assert analysis.json()["findings_summary"]["total_findings"] > 0

    findings = client.get(f"/api/investigations/{investigation_id}/findings")
    assert findings.status_code == 200
    assert len(findings.json()) > 0

    report = client.get(f"/api/investigations/{investigation_id}/report")
    assert report.status_code == 200
    body = report.json()
    assert body["start_account"]["account_number"] == "ACC1001"
    assert body["dfs_results"]["traversal_order"][0] == "ACC1001"
    assert body["findings_summary"]["total_findings"] > 0

    listed = client.get("/api/investigations/")
    assert listed.status_code == 200
    assert any(i["id"] == investigation_id for i in listed.json())


def test_dataset_reset_restores_demo_data(bootstrapped):
    client = bootstrapped

    # Mutate the workspace.
    client.post(
        "/api/accounts/",
        json={"account_number": "ACC9999", "account_holder": "Ephemeral", "balance": 1},
    )
    assert len(get_accounts(client)) == 16

    reset = client.post("/api/sessions/reset")
    assert reset.status_code == 200
    assert reset.json()["accounts_count"] == 15

    accounts = get_accounts(client)
    assert len(accounts) == 15
    assert all(a["account_number"] != "ACC9999" for a in accounts)
