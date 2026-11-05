"""Two independent visitors must never see each other's data."""

from fastapi.testclient import TestClient

from app.main import app


def test_two_sessions_are_isolated():
    with TestClient(app) as alice, TestClient(app) as bob:
        assert alice.post("/api/sessions/bootstrap").status_code == 201
        assert bob.post("/api/sessions/bootstrap").status_code == 201

        alice_id = alice.get("/api/sessions/me").json()["id"]
        bob_id = bob.get("/api/sessions/me").json()["id"]
        assert alice_id != bob_id

        # Alice creates a private account.
        created = alice.post(
            "/api/accounts/",
            json={"account_number": "ALICE01", "account_holder": "Alice", "balance": 1000},
        )
        assert created.status_code == 201
        alice_account_id = created.json()["id"]

        # Bob must not see it, either in a list or by direct id.
        bob_accounts = bob.get("/api/accounts/?limit=100").json()
        assert all(a["account_number"] != "ALICE01" for a in bob_accounts)
        assert bob.get(f"/api/accounts/{alice_account_id}").status_code == 404

        # Bob cannot delete Alice's account.
        assert bob.delete(f"/api/accounts/{alice_account_id}").status_code == 404

        # Bob cannot add a transaction using Alice's private account ids.
        bob_account = next(
            a for a in bob_accounts if a["account_number"] == "ACC1001"
        )
        cross = bob.post(
            "/api/transactions/",
            json={
                "source_account_id": alice_account_id,
                "destination_account_id": bob_account["id"],
                "amount": 100,
            },
        )
        assert cross.status_code == 400

        # Alice still sees exactly one extra account.
        assert len(alice.get("/api/accounts/?limit=100").json()) == 16


def test_forged_cookie_is_rejected():
    with TestClient(app) as client:
        client.cookies.set("traceledger_session", "forged-token-value")
        assert client.get("/api/accounts/").status_code == 401
        assert client.get("/api/sessions/me").status_code == 401


def test_reset_does_not_affect_other_session():
    with TestClient(app) as alice, TestClient(app) as bob:
        alice.post("/api/sessions/bootstrap")
        bob.post("/api/sessions/bootstrap")

        alice.post(
            "/api/accounts/",
            json={"account_number": "ALICE02", "account_holder": "Alice Two", "balance": 1000},
        )
        bob.post("/api/sessions/reset")

        alice_accounts = alice.get("/api/accounts/?limit=100").json()
        assert any(a["account_number"] == "ALICE02" for a in alice_accounts)
        bob_accounts = bob.get("/api/accounts/?limit=100").json()
        assert all(a["account_number"] != "ALICE02" for a in bob_accounts)
