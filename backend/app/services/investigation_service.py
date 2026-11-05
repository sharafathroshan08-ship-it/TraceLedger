from sqlalchemy.orm import Session as DBSession
from ..models import Investigation, Account, Finding
from ..schemas import InvestigationCreate, InvestigationResponse, DFSResult
from .graph_service import GraphService
from .detection_service import DetectionService
from typing import Any, Dict, List, Optional
from datetime import datetime
import json


def _parse_json(value: Optional[str]) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return None


class InvestigationService:
    """
    Orchestrates investigations: persistence, DFS execution, pattern analysis
    and report assembly.
    """

    def __init__(self, db: DBSession):
        self.db = db

    # ------------------------------------------------------------------
    def _to_response(self, inv: Investigation) -> InvestigationResponse:
        return InvestigationResponse(
            id=inv.id,
            session_id=inv.session_id,
            start_account_id=inv.start_account_id,
            start_time=inv.start_time,
            end_time=inv.end_time,
            dfs_traversal=_parse_json(inv.dfs_traversal),
            suspicious_patterns=_parse_json(inv.suspicious_patterns),
            report_generated=inv.report_generated,
        )

    # ------------------------------------------------------------------
    def create_investigation(
        self, session_id: str, investigation_data: InvestigationCreate
    ) -> InvestigationResponse:
        account = self.db.query(Account).filter(
            Account.id == investigation_data.start_account_id,
            Account.session_id == session_id,
        ).first()
        if not account:
            raise ValueError(f"Start account not found: {investigation_data.start_account_id}")

        inv = Investigation(
            session_id=session_id,
            start_account_id=investigation_data.start_account_id,
            start_time=datetime.utcnow(),
            report_generated=False,
        )
        self.db.add(inv)
        self.db.commit()
        self.db.refresh(inv)
        return self._to_response(inv)

    def get_investigation(self, session_id: str, investigation_id: int) -> InvestigationResponse:
        inv = self.db.query(Investigation).filter(
            Investigation.id == investigation_id,
            Investigation.session_id == session_id,
        ).first()
        if not inv:
            raise ValueError(f"Investigation not found: {investigation_id}")
        return self._to_response(inv)

    def list_investigations(self, session_id: str) -> List[InvestigationResponse]:
        rows = self.db.query(Investigation).filter(
            Investigation.session_id == session_id
        ).order_by(Investigation.start_time.desc()).all()
        return [self._to_response(r) for r in rows]

    # ------------------------------------------------------------------
    def run_investigation_dfs(self, session_id: str, investigation_id: int) -> DFSResult:
        inv = self.db.query(Investigation).filter(
            Investigation.id == investigation_id,
            Investigation.session_id == session_id,
        ).first()
        if not inv:
            raise ValueError(f"Investigation not found: {investigation_id}")

        account = self.db.query(Account).filter(
            Account.id == inv.start_account_id,
            Account.session_id == session_id,
        ).first()
        if not account:
            raise ValueError(f"Start account not found: {inv.start_account_id}")

        result = GraphService(self.db).run_dfs(session_id, account.account_number)

        inv.dfs_traversal = json.dumps(
            {
                "start_account": result.start_account,
                "traversal_order": result.traversal_order,
                "visited": result.visited,
                "adjacency_list": result.adjacency_list,
                "time_complexity": result.time_complexity,
                "space_complexity": result.space_complexity,
            }
        )
        self.db.commit()
        return result

    # ------------------------------------------------------------------
    def analyze_investigation_patterns(
        self,
        session_id: str,
        investigation_id: int,
        start_account_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        inv = self.db.query(Investigation).filter(
            Investigation.id == investigation_id,
            Investigation.session_id == session_id,
        ).first()
        if not inv:
            raise ValueError(f"Investigation not found: {investigation_id}")

        # Default to the investigation's own start account when none is given.
        focus_id = start_account_id or inv.start_account_id
        findings = DetectionService(self.db).analyze_transactions(
            session_id, start_account_id=focus_id
        )

        # Attach the findings to this investigation.
        for finding in findings:
            row = self.db.query(Finding).filter(Finding.id == finding.id).first()
            if row:
                row.investigation_id = investigation_id
        self.db.commit()

        summary: Dict[str, Any] = {
            "total_findings": len(findings),
            "findings_by_type": {},
            "findings_by_severity": {},
        }
        for finding in findings:
            summary["findings_by_type"][finding.finding_type] = (
                summary["findings_by_type"].get(finding.finding_type, 0) + 1
            )
            summary["findings_by_severity"][finding.severity] = (
                summary["findings_by_severity"].get(finding.severity, 0) + 1
            )

        inv.suspicious_patterns = json.dumps(summary)
        inv.end_time = datetime.utcnow()
        self.db.commit()

        return {
            "investigation_id": investigation_id,
            "findings_summary": summary,
            "findings": findings,
            "analysis_completed_at": datetime.utcnow().isoformat(),
        }

    # ------------------------------------------------------------------
    def generate_report(self, session_id: str, investigation_id: int) -> Dict[str, Any]:
        inv = self.db.query(Investigation).filter(
            Investigation.id == investigation_id,
            Investigation.session_id == session_id,
        ).first()
        if not inv:
            raise ValueError(f"Investigation not found: {investigation_id}")

        account = self.db.query(Account).filter(Account.id == inv.start_account_id).first()
        if not account:
            raise ValueError(f"Start account not found: {inv.start_account_id}")

        dfs_data = _parse_json(inv.dfs_traversal) or {}
        findings = self.db.query(Finding).filter(
            Finding.session_id == session_id,
            Finding.investigation_id == investigation_id,
        ).all()

        report = {
            "investigation_id": investigation_id,
            "session_id": session_id,
            "generated_at": datetime.utcnow().isoformat(),
            "start_time": inv.start_time.isoformat() if inv.start_time else None,
            "end_time": inv.end_time.isoformat() if inv.end_time else None,
            "start_account": {
                "id": account.id,
                "account_number": account.account_number,
                "account_holder": account.account_holder,
                "balance": account.balance,
            },
            "dfs_results": {
                "traversal_order": dfs_data.get("traversal_order", []),
                "visited_accounts": dfs_data.get("visited", []),
                "time_complexity": dfs_data.get("time_complexity", "O(V + E)"),
                "space_complexity": dfs_data.get("space_complexity", "O(V)"),
            },
            "findings_summary": {
                "total_findings": len(findings),
                "findings_by_type": {},
                "findings_by_severity": {},
            },
            "findings": [
                {
                    "id": f.id,
                    "type": f.finding_type,
                    "severity": f.severity,
                    "description": f.description,
                    "evidence": _parse_json(f.evidence),
                }
                for f in findings
            ],
        }

        for f in findings:
            report["findings_summary"]["findings_by_type"][f.finding_type] = (
                report["findings_summary"]["findings_by_type"].get(f.finding_type, 0) + 1
            )
            report["findings_summary"]["findings_by_severity"][f.severity] = (
                report["findings_summary"]["findings_by_severity"].get(f.severity, 0) + 1
            )

        inv.report_generated = True
        self.db.commit()
        return report

    # ------------------------------------------------------------------
    def delete_investigation(self, session_id: str, investigation_id: int) -> bool:
        inv = self.db.query(Investigation).filter(
            Investigation.id == investigation_id,
            Investigation.session_id == session_id,
        ).first()
        if not inv:
            return False
        self.db.query(Finding).filter(
            Finding.investigation_id == investigation_id
        ).delete(synchronize_session=False)
        self.db.delete(inv)
        self.db.commit()
        return True
