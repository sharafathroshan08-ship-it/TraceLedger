from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_session_id
from ..schemas import FindingCreate, FindingResponse
from ..services import DetectionService

router = APIRouter()


@router.get("/summary")
def summary(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Detection counts without writing findings (dashboard cards)."""
    return DetectionService(db).summary(session_id)


@router.post("/analyze", response_model=List[FindingResponse])
def analyze(
    start_account_id: Optional[int] = None,
    high_value_threshold: int = 1_00_000_00,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Run all five detectors for the current workspace."""
    return DetectionService(db).analyze_transactions(
        session_id,
        start_account_id=start_account_id,
        high_value_threshold=high_value_threshold,
    )


@router.post("/patterns/transaction-chain", response_model=List[FindingResponse])
def transaction_chains(
    min_length: int = 3,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).detect_transaction_chains(session_id, min_length)


@router.post("/patterns/circular", response_model=List[FindingResponse])
def circular(
    max_cycle_length: int = 6,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).detect_circular_transactions(session_id, max_cycle_length)


@router.post("/patterns/rapid-movement", response_model=List[FindingResponse])
def rapid_movement(
    time_window_minutes: int = 120,
    min_transactions: int = 3,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).detect_rapid_movement(session_id, time_window_minutes, min_transactions)


@router.post("/patterns/high-value", response_model=List[FindingResponse])
def high_value(
    min_amount: int = 1_00_000_00,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).detect_high_value_transactions(session_id, min_amount)


@router.post("/patterns/intermediary", response_model=List[FindingResponse])
def intermediary(
    min_receivers: int = 2,
    min_distributors: int = 2,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).detect_intermediary_transactions(
        session_id, min_receivers, min_distributors
    )


@router.post("/findings", response_model=FindingResponse, status_code=201)
def create_finding(
    finding_data: FindingCreate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).create_finding(session_id, finding_data)


@router.get("/findings/{finding_id}", response_model=FindingResponse)
def get_finding(
    finding_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return DetectionService(db).get_finding(session_id, finding_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
