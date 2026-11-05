import os
import sys
import tempfile
from pathlib import Path

# Put the backend root on sys.path so `app` is importable when running pytest
# from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Point the app at a throwaway SQLite file *before* app.database is imported.
_TMP_DB = Path(tempfile.gettempdir()) / "traceledger_test.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["TRACELEDGER_DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client():
    """A fresh browser-like client with its own cookie jar."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def bootstrapped(client):
    """Bootstrap a workspace (which also seeds demo data) and return the client."""
    response = client.post("/api/sessions/bootstrap")
    assert response.status_code == 201, response.text
    return client
