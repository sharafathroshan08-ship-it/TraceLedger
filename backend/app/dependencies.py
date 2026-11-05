"""
Shared FastAPI dependencies.

The session token lives in an HttpOnly cookie so the browser JavaScript can
never read or forge it. A raw header is accepted as a fallback for tests and
for non-browser clients.
"""

import os
from datetime import datetime

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session as DBSession

from .database import get_db
from .models import Session

SESSION_COOKIE = "traceledger_session"
SESSION_TTL_HOURS = 24

# Local development runs over plain HTTP, where a Secure cookie would never be
# sent back. Production deployments terminate TLS, so set
# TRACELEDGER_COOKIE_SECURE=true there (see docs/api.md).
COOKIE_SECURE = os.getenv("TRACELEDGER_COOKIE_SECURE", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _is_valid(db: DBSession, token: str) -> bool:
    row = (
        db.query(Session)
        .filter(
            Session.id == token,
            Session.is_active.is_(True),
            Session.expires_at > datetime.utcnow(),
        )
        .first()
    )
    return row is not None


def get_current_session_id(
    request: Request, db: DBSession = Depends(get_db)
) -> str:
    """Resolve and validate the active session token."""
    token = request.cookies.get(SESSION_COOKIE) or request.headers.get("X-Session-Token")
    if not token:
        raise HTTPException(status_code=401, detail="No active session. Call /api/sessions/bootstrap first.")
    if not _is_valid(db, token):
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    return token


def set_session_cookie(response: Response, token: str, secure: bool = False) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=SESSION_TTL_HOURS * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
