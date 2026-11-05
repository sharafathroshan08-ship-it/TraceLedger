"""
Rule-based suspicious transaction detection.

These are *educational heuristics* used to demonstrate how graph structure and
simple statistics can surface patterns worth a human investigator's attention.
No finding here is proof of wrongdoing.
"""

from sqlalchemy.orm import Session as DBSession
from ..models import Transaction, Account, Finding
from ..schemas import FindingCreate, FindingResponse
from typing import Any, Dict, List, Optional, Set
from datetime import datetime, timedelta
import json

# Default rule thresholds (amounts are in paise; 1 rupee = 100 paise)
DEFAULT_HIGH_VALUE_PAISE = 1_00_000_00  # ₹1,00,000
DEFAULT_RAPID_WINDOW_MINUTES = 120
DEFAULT_RAPID_MIN_TRANSACTIONS = 3


class DetectionService:
    """
    Detects five families of suspicious patterns over a session's transactions.

    Each detector is independent and returns `FindingResponse` objects. The
    detection engine is deliberately kept separate from the DFS implementation
    in `app/graph.py`.
    """

    def __init__(self, db: DBSession):
        self.db = db
        # When True, detectors return findings without writing them to the DB.
        self._dry_run = False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _account_map(self, session_id: str) -> Dict[int, Account]:
        accounts = self.db.query(Account).filter(Account.session_id == session_id).all()
        return {a.id: a for a in accounts}

    def _transactions(self, session_id: str) -> List[Transaction]:
        return (
            self.db.query(Transaction)
            .filter(Transaction.session_id == session_id)
            .order_by(Transaction.timestamp.asc())
            .all()
        )

    def _build_edges(
        self, session_id: str
    ) -> tuple[Dict[str, List[str]], Dict[str, List[Transaction]], List[Transaction]]:
        """Return adjacency list, per-source transactions, and all transactions."""
        accounts = self._account_map(session_id)
        adjacency: Dict[str, List[str]] = {}
        sent: Dict[str, List[Transaction]] = {}
        transactions = self._transactions(session_id)

        for acc in accounts.values():
            adjacency.setdefault(acc.account_number, [])
            sent.setdefault(acc.account_number, [])

        for tx in transactions:
            src = accounts.get(tx.source_account_id)
            dst = accounts.get(tx.destination_account_id)
            if not src or not dst:
                continue
            adjacency.setdefault(src.account_number, []).append(dst.account_number)
            sent.setdefault(src.account_number, []).append(tx)

        return adjacency, sent, transactions

    def _persist(self, session_id: str, data: FindingCreate, transaction_id: Optional[int] = None) -> FindingResponse:
        if self._dry_run:
            return FindingResponse(
                id=0,
                session_id=session_id,
                investigation_id=None,
                finding_type=data.finding_type,
                severity=data.severity,
                description=data.description,
                transaction_id=transaction_id,
                evidence=data.evidence,
                detected_at=datetime.utcnow(),
            )

        finding = Finding(
            session_id=session_id,
            finding_type=data.finding_type,
            severity=data.severity,
            description=data.description,
            transaction_id=transaction_id,
            evidence=json.dumps(data.evidence) if data.evidence else None,
        )
        self.db.add(finding)
        self.db.commit()
        self.db.refresh(finding)
        return FindingResponse(
            id=finding.id,
            session_id=finding.session_id,
            investigation_id=finding.investigation_id,
            finding_type=finding.finding_type,
            severity=finding.severity,
            description=finding.description,
            transaction_id=finding.transaction_id,
            evidence=json.loads(finding.evidence) if finding.evidence else None,
            detected_at=finding.detected_at,
        )

    # ------------------------------------------------------------------
    # 1. Transaction chain: A -> B -> C -> D
    # ------------------------------------------------------------------
    def detect_transaction_chains(
        self, session_id: str, min_length: int = 3, max_length: int = 8
    ) -> List[FindingResponse]:
        adjacency, sent, _ = self._build_edges(session_id)
        findings: List[FindingResponse] = []
        seen_chains: Set[tuple] = set()
        max_chains = 20  # keep the demo output readable

        def walk(path: List[str]):
            if len(findings) >= max_chains:
                return

            tail = path[-1]
            extended = False
            for neighbor in adjacency.get(tail, []):
                if neighbor in path:  # do not reuse accounts inside one chain
                    continue
                if len(path) >= max_length:
                    extended = True
                    break
                extended = True
                walk(path + [neighbor])

            # Record a maximal simple path (or one that hit the length cap).
            if (not extended or len(path) >= max_length) and len(path) >= min_length:
                key = tuple(path)
                if key not in seen_chains:
                    seen_chains.add(key)
                    findings.append(self._chain_finding(session_id, path, sent))

        for start in adjacency:
            walk([start])

        return findings

    def _chain_finding(self, session_id: str, chain: List[str], sent: Dict[str, List[Transaction]]) -> FindingResponse:
        involved_tx: List[Transaction] = []
        for i in range(len(chain) - 1):
            for tx in sent.get(chain[i], []):
                involved_tx.append(tx)
                break
        data = FindingCreate(
            finding_type="transaction_chain",
            severity="high" if len(chain) >= 5 else "medium",
            description=f"Transaction chain of length {len(chain)}: {' -> '.join(chain)}",
            evidence={
                "chain": chain,
                "length": len(chain),
                "involved_accounts": chain,
                "involved_transactions": [t.transaction_id for t in involved_tx],
            },
        )
        return self._persist(session_id, data)

    # ------------------------------------------------------------------
    # 2. Circular transaction: A -> B -> C -> A
    # ------------------------------------------------------------------
    def detect_circular_transactions(self, session_id: str, max_cycle_length: int = 6) -> List[FindingResponse]:
        adjacency, sent, _ = self._build_edges(session_id)
        findings: List[FindingResponse] = []
        seen: Set[tuple] = set()

        def canonical(cycle: List[str]) -> tuple:
            # Rotate so the lexicographically smallest node is first.
            body = cycle[:-1]
            if not body:
                return tuple()
            idx = body.index(min(body))
            rotated = body[idx:] + body[:idx]
            return tuple(rotated)

        def dfs(node: str, path: List[str]):
            if len(findings) >= 15:
                return
            for neighbor in adjacency.get(node, []):
                if neighbor == path[0] and len(path) >= 2:
                    key = canonical(path + [neighbor])
                    if key not in seen and len(path) + 1 <= max_cycle_length:
                        seen.add(key)
                        findings.append(self._cycle_finding(session_id, path + [neighbor], sent))
                elif neighbor not in path and len(path) < max_cycle_length:
                    dfs(neighbor, path + [neighbor])

        for start in adjacency:
            dfs(start, [start])

        return findings

    def _cycle_finding(self, session_id: str, cycle: List[str], sent: Dict[str, List[Transaction]]) -> FindingResponse:
        involved_tx: List[Transaction] = []
        for i in range(len(cycle) - 1):
            for tx in sent.get(cycle[i], []):
                involved_tx.append(tx)
                break
        data = FindingCreate(
            finding_type="circular_transaction",
            severity="high",
            description=f"Circular flow detected: {' -> '.join(cycle)}",
            evidence={
                "cycle": cycle,
                "cycle_length": len(cycle) - 1,
                "involved_accounts": cycle[:-1],
                "involved_transactions": [t.transaction_id for t in involved_tx],
            },
        )
        return self._persist(session_id, data)

    # ------------------------------------------------------------------
    # 3. Rapid fund movement
    # ------------------------------------------------------------------
    def detect_rapid_movement(
        self,
        session_id: str,
        time_window_minutes: int = DEFAULT_RAPID_WINDOW_MINUTES,
        min_transactions: int = DEFAULT_RAPID_MIN_TRANSACTIONS,
    ) -> List[FindingResponse]:
        accounts = self._account_map(session_id)
        transactions = self._transactions(session_id)
        if not transactions:
            return []

        # Anchor the window on the newest transaction so the rule still works
        # for demo data that was seeded in the past.
        anchor = max((t.timestamp for t in transactions if t.timestamp), default=datetime.utcnow())
        window_start = anchor - timedelta(minutes=time_window_minutes)

        active: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            if not tx.timestamp or tx.timestamp < window_start:
                continue
            active.setdefault(tx.source_account_id, []).append(tx)
            active.setdefault(tx.destination_account_id, []).append(tx)

        findings: List[FindingResponse] = []
        for account_id, txs in active.items():
            if len(txs) < min_transactions:
                continue
            account = accounts.get(account_id)
            if not account:
                continue
            data = FindingCreate(
                finding_type="rapid_movement",
                severity="high" if len(txs) >= min_transactions * 2 else "medium",
                description=(
                    f"Account {account.account_number} moved funds in {len(txs)} "
                    f"transactions within {time_window_minutes} minutes"
                ),
                evidence={
                    "account_id": account_id,
                    "account_number": account.account_number,
                    "transaction_count": len(txs),
                    "time_window_minutes": time_window_minutes,
                    "involved_transactions": [t.transaction_id for t in txs],
                    "total_amount": sum(t.amount for t in txs),
                },
            )
            findings.append(self._persist(session_id, data))
        return findings

    # ------------------------------------------------------------------
    # 4. High-value transfer
    # ------------------------------------------------------------------
    def detect_high_value_transactions(
        self, session_id: str, min_amount: int = DEFAULT_HIGH_VALUE_PAISE
    ) -> List[FindingResponse]:
        accounts = self._account_map(session_id)
        transactions = self._transactions(session_id)
        findings: List[FindingResponse] = []

        for tx in transactions:
            if tx.amount < min_amount:
                continue
            src = accounts.get(tx.source_account_id)
            dst = accounts.get(tx.destination_account_id)
            if not src or not dst:
                continue
            data = FindingCreate(
                finding_type="high_value_transfer",
                severity="critical" if tx.amount >= min_amount * 5 else "high",
                description=(
                    f"High-value transfer of ₹{tx.amount / 100:,.2f} from "
                    f"{src.account_number} to {dst.account_number}"
                ),
                transaction_id=tx.id,
                evidence={
                    "transaction_id": tx.transaction_id,
                    "amount_paise": tx.amount,
                    "source_account": src.account_number,
                    "destination_account": dst.account_number,
                    "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                    "threshold_paise": min_amount,
                },
            )
            findings.append(self._persist(session_id, data, tx.id))
        return findings

    # ------------------------------------------------------------------
    # 5. Suspicious intermediary
    # ------------------------------------------------------------------
    def detect_intermediary_transactions(
        self,
        session_id: str,
        min_receivers: int = 2,
        min_distributors: int = 2,
    ) -> List[FindingResponse]:
        accounts = self._account_map(session_id)
        transactions = self._transactions(session_id)

        incoming: Dict[int, List[Transaction]] = {}
        outgoing: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            incoming.setdefault(tx.destination_account_id, []).append(tx)
            outgoing.setdefault(tx.source_account_id, []).append(tx)

        findings: List[FindingResponse] = []
        for account_id, account in accounts.items():
            in_txs = incoming.get(account_id, [])
            out_txs = outgoing.get(account_id, [])
            receivers = {t.source_account_id for t in in_txs}
            distributors = {t.destination_account_id for t in out_txs}
            if len(receivers) < min_receivers or len(distributors) < min_distributors:
                continue

            data = FindingCreate(
                finding_type="suspicious_intermediary",
                severity="high",
                description=(
                    f"Account {account.account_number} receives from "
                    f"{len(receivers)} accounts and redistributes to {len(distributors)}"
                ),
                evidence={
                    "account_id": account_id,
                    "account_number": account.account_number,
                    "receivers_count": len(receivers),
                    "distributors_count": len(distributors),
                    "incoming_transaction_ids": [t.transaction_id for t in in_txs],
                    "outgoing_transaction_ids": [t.transaction_id for t in out_txs],
                    "total_received_paise": sum(t.amount for t in in_txs),
                    "total_sent_paise": sum(t.amount for t in out_txs),
                },
            )
            findings.append(self._persist(session_id, data))
        return findings

    # ------------------------------------------------------------------
    # Aggregate analysis
    # ------------------------------------------------------------------
    def analyze_transactions(
        self,
        session_id: str,
        start_account_id: Optional[int] = None,
        high_value_threshold: int = DEFAULT_HIGH_VALUE_PAISE,
        dry_run: bool = False,
    ) -> List[FindingResponse]:
        """
        Run all five detectors and return their combined findings.

        `start_account_id` filters findings to those that touch the selected
        account when provided (useful for focused investigations).
        `dry_run` computes findings without writing them to the database.
        """
        previous = self._dry_run
        self._dry_run = dry_run
        try:
            findings: List[FindingResponse] = []
            findings.extend(self.detect_transaction_chains(session_id))
            findings.extend(self.detect_circular_transactions(session_id))
            findings.extend(self.detect_rapid_movement(session_id))
            findings.extend(self.detect_high_value_transactions(session_id, high_value_threshold))
            findings.extend(self.detect_intermediary_transactions(session_id))
        finally:
            self._dry_run = previous

        if start_account_id is None:
            return findings

        account = self.db.query(Account).filter(
            Account.id == start_account_id, Account.session_id == session_id
        ).first()
        if not account:
            return findings

        number = account.account_number
        filtered = [
            f for f in findings
            if f.evidence and number in json.dumps(f.evidence)
        ]
        return filtered

    # ------------------------------------------------------------------
    # Findings read / manual creation
    # ------------------------------------------------------------------
    def create_finding(self, session_id: str, finding_data: FindingCreate) -> FindingResponse:
        return self._persist(session_id, finding_data, finding_data.transaction_id)

    def get_finding(self, session_id: str, finding_id: int) -> FindingResponse:
        finding = self.db.query(Finding).filter(
            Finding.id == finding_id, Finding.session_id == session_id
        ).first()
        if not finding:
            raise ValueError(f"Finding not found: {finding_id}")
        return FindingResponse(
            id=finding.id,
            session_id=finding.session_id,
            investigation_id=finding.investigation_id,
            finding_type=finding.finding_type,
            severity=finding.severity,
            description=finding.description,
            transaction_id=finding.transaction_id,
            evidence=json.loads(finding.evidence) if finding.evidence else None,
            detected_at=finding.detected_at,
        )

    def get_investigation_findings(self, session_id: str, investigation_id: int) -> List[FindingResponse]:
        rows = self.db.query(Finding).filter(
            Finding.session_id == session_id,
            Finding.investigation_id == investigation_id,
        ).all()
        return [
            FindingResponse(
                id=f.id,
                session_id=f.session_id,
                investigation_id=f.investigation_id,
                finding_type=f.finding_type,
                severity=f.severity,
                description=f.description,
                transaction_id=f.transaction_id,
                evidence=json.loads(f.evidence) if f.evidence else None,
                detected_at=f.detected_at,
            ) for f in rows
        ]

    def summary(self, session_id: str) -> Dict[str, Any]:
        """Count findings without persisting them (used by the dashboard)."""
        findings = self.analyze_transactions(session_id, dry_run=True)
        by_severity: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        for finding in findings:
            by_severity[finding.severity] = by_severity.get(finding.severity, 0) + 1
            by_type[finding.finding_type] = by_type.get(finding.finding_type, 0) + 1
        return {
            "total": len(findings),
            "by_severity": by_severity,
            "by_type": by_type,
        }

    def create_investigation(self, session_id: str, investigation_data):
        from .investigation_service import InvestigationService
        return InvestigationService(self.db).create_investigation(session_id, investigation_data)

    def get_investigation(self, session_id: str, investigation_id: int):
        from .investigation_service import InvestigationService
        return InvestigationService(self.db).get_investigation(session_id, investigation_id)
