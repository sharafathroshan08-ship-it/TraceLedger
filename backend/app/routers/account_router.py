from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_session_id
from ..schemas import AccountCreate, AccountResponse, AccountUpdate, AccountSearch
from ..services import AccountService, GraphService

router = APIRouter()


@router.post("/", response_model=AccountResponse, status_code=201)
def create_account(
    account_data: AccountCreate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Create an account inside the current workspace."""
    try:
        return AccountService(db).create_account(session_id, account_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/", response_model=List[AccountResponse])
def list_accounts(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """List accounts. `q` matches account number or holder name."""
    search = AccountSearch(
        account_number=q or None,
        account_holder=q or None,
        limit=min(limit, 200),
        offset=offset,
    )
    service = AccountService(db)
    if q:
        # Search both fields and merge, because the search model ANDs filters.
        by_number = service.list_accounts(session_id, AccountSearch(account_number=q, limit=limit, offset=offset))
        by_holder = service.list_accounts(session_id, AccountSearch(account_holder=q, limit=limit, offset=offset))
        merged = {a.id: a for a in by_number + by_holder}
        return list(merged.values())
    return service.list_accounts(session_id, search)


@router.get("/search", response_model=Optional[AccountResponse])
def search_account(
    number: str,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Search one account by exact account number."""
    return AccountService(db).search_account(session_id, number.upper())


@router.get("/{account_id}/neighbors")
def account_neighbors(
    account_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Return accounts directly connected by a transaction."""
    try:
        account = AccountService(db).get_account(session_id, account_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    graph_service = GraphService(db)
    return {
        "account": account,
        "neighbors": graph_service.get_account_neighbors(session_id, account.account_number),
    }


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return AccountService(db).get_account(session_id, account_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account_data: AccountUpdate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return AccountService(db).update_account(session_id, account_id, account_data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Delete an account and its transactions."""
    from ..models import Transaction
    db.query(Transaction).filter(
        Transaction.session_id == session_id,
        (Transaction.source_account_id == account_id)
        | (Transaction.destination_account_id == account_id),
    ).delete(synchronize_session=False)
    db.commit()

    deleted = AccountService(db).delete_account(session_id, account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Account not found: {account_id}")
    return {"message": f"Account {account_id} deleted"}
