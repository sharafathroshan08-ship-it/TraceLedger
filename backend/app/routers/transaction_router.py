from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_session_id
from ..schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionSearch,
)
from ..services import TransactionService

router = APIRouter()


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(
    transaction_data: TransactionCreate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    if transaction_data.source_account_id == transaction_data.destination_account_id:
        raise HTTPException(status_code=400, detail="Source and destination accounts must differ.")
    try:
        return TransactionService(db).create_transaction(session_id, transaction_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/", response_model=List[TransactionResponse])
def list_transactions(
    q: Optional[str] = None,
    account_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    search = TransactionSearch(
        source_account_id=account_id,
        transaction_type=transaction_type,
        limit=min(limit, 500),
        offset=offset,
    )
    service = TransactionService(db)
    results = service.list_transactions(session_id, search)

    if q:
        needle = q.lower()
        results = [
            t
            for t in results
            if needle in (t.transaction_id or "").lower()
            or needle in (t.description or "").lower()
        ]
    return results


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return TransactionService(db).get_transaction(session_id, transaction_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return TransactionService(db).update_transaction(session_id, transaction_id, transaction_data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    deleted = TransactionService(db).delete_transaction(session_id, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Transaction not found: {transaction_id}")
    return {"message": f"Transaction {transaction_id} deleted"}
