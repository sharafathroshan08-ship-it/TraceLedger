from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import Any, Dict, List

from ..database import get_db
from ..dependencies import get_current_session_id
from ..schemas import DFSResult
from ..services import GraphService

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
def get_graph(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """Return accounts, directed transactions, and the adjacency list."""
    return GraphService(db).get_graph_data(session_id)


@router.post("/dfs/{start_account}", response_model=DFSResult)
def run_dfs(
    start_account: str,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    """
    Execute iterative DFS from an account number and return the real traversal.
    """
    result = GraphService(db).run_dfs(session_id, start_account.upper())
    if not result.traversal_order:
        raise HTTPException(status_code=404, detail=f"Account not found in graph: {start_account}")
    return result


@router.get("/components", response_model=List[List[str]])
def connected_components(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return GraphService(db).get_connected_components(session_id)


@router.get("/cycles", response_model=List[List[str]])
def cycles(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return GraphService(db).detect_cycles(session_id)


@router.get("/is-connected")
def is_connected(
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return {"connected": GraphService(db).check_graph_connected(session_id)}


@router.get("/neighbors/{account_number}")
def neighbors(
    account_number: str,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return {
        "account": account_number.upper(),
        "neighbors": GraphService(db).get_account_neighbors(session_id, account_number.upper()),
    }


@router.get("/reachable/{start_account}")
def reachable(
    start_account: str,
    session_id: str = Depends(get_current_session_id),
    db: DBSession = Depends(get_db),
):
    return {
        "start_account": start_account.upper(),
        "reachable": GraphService(db).get_reachable_accounts(session_id, start_account.upper()),
    }
