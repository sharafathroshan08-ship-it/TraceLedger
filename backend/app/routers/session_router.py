from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..models import Account, Transaction, Investigation, Session
from ..schemas import SessionResponse, SessionInfo
from ..services import SessionService
from ..demo_data import seed_demo_data
from ..dependencies import (
    COOKIE_SECURE,
    get_current_session_id,
    set_session_cookie,
    clear_session_cookie,
)

router = APIRouter()


def _session_info(db: DBSession, session_id: str) -> SessionInfo:
    return SessionInfo(
        id=session_id,
        accounts_count=db.query(Account).filter(Account.session_id == session_id).count(),
        transactions_count=db.query(Transaction).filter(Transaction.session_id == session_id).count(),
        investigations_count=db.query(Investigation).filter(Investigation.session_id == session_id).count(),
    )


@router.post("/bootstrap", response_model=SessionInfo, status_code=201)
def bootstrap_session(response: Response, db: DBSession = Depends(get_db)):
    """
    Create a fresh anonymous workspace, preload the demo dataset, and set the
    HttpOnly session cookie. This is the only endpoint that issues tokens.
    """
    session_service = SessionService(db)
    created = session_service.create_session()
    seed_demo_data(db, created.id)
    set_session_cookie(response, created.id, secure=COOKIE_SECURE)
    return _session_info(db, created.id)


@router.get("/me", response_model=SessionInfo)
def session_info(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Return the current workspace statistics."""
    return _session_info(db, session_id)


@router.post("/reset", response_model=SessionInfo)
def reset_dataset(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Restore the original synthetic demo dataset for this workspace."""
    seed_demo_data(db, session_id)
    return _session_info(db, session_id)


@router.delete("/")
def delete_session(
    response: Response,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Delete the workspace and every row scoped to it."""
    SessionService(db).delete_session(session_id)
    clear_session_cookie(response)
    return {"message": "Session deleted"}
