from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import Any, Dict, List, Optional

from ..database import get_db
from ..dependencies import get_current_session_id
from ..schemas import InvestigationCreate, InvestigationResponse, FindingResponse
from ..services import InvestigationService, DetectionService

router = APIRouter()


@router.post("/", response_model=InvestigationResponse, status_code=201)
def create_investigation(
    investigation_data: InvestigationCreate,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return InvestigationService(db).create_investigation(session_id, investigation_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/", response_model=List[InvestigationResponse])
def list_investigations(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return InvestigationService(db).list_investigations(session_id)


@router.get("/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(
    investigation_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return InvestigationService(db).get_investigation(session_id, investigation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{investigation_id}/run-dfs")
def run_dfs(
    investigation_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return InvestigationService(db).run_investigation_dfs(session_id, investigation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{investigation_id}/analyze")
def analyze(
    investigation_id: int,
    start_account_id: Optional[int] = None,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return InvestigationService(db).analyze_investigation_patterns(
            session_id, investigation_id, start_account_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{investigation_id}/findings", response_model=List[FindingResponse])
def findings(
    investigation_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return DetectionService(db).get_investigation_findings(session_id, investigation_id)


@router.get("/{investigation_id}/report")
def report(
    investigation_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    try:
        return InvestigationService(db).generate_report(session_id, investigation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{investigation_id}")
def delete_investigation(
    investigation_id: int,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    deleted = InvestigationService(db).delete_investigation(session_id, investigation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Investigation not found: {investigation_id}")
    return {"message": f"Investigation {investigation_id} deleted"}
