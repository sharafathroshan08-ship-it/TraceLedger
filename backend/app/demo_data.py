"""
Synthetic demo dataset for TraceLedger.

Everything here is fictional. The dataset is designed to exercise:
  * a long transaction chain
  * circular transaction flows
  * rapid fund movement
  * one high-value transfer
  * a suspicious intermediary account
  * a disconnected two-account component

Amounts are stored as integer paise (1 rupee = 100 paise).
"""

from datetime import datetime, timedelta
from typing import List, Tuple

from sqlalchemy.orm import Session as DBSession

from .models import Account, Transaction, Investigation, Finding

# (account_number, holder_name, opening_balance_paise)
DEMO_ACCOUNTS: List[Tuple[str, str, int]] = [
    ("ACC1001", "Aarav Sharma", 10_00_000_00),
    ("ACC1002", "Meera Iyer", 10_00_000_00),
    ("ACC1003", "Rohit Verma", 10_00_000_00),
    ("ACC1004", "Ananya Nair", 10_00_000_00),
    ("ACC1005", "Kabir Singh", 10_00_000_00),
    ("ACC1006", "Priya Menon", 10_00_000_00),
    ("ACC1007", "Dev Patel", 10_00_000_00),
    ("ACC1008", "Sara Khan", 10_00_000_00),
    ("ACC1009", "Vikram Rao", 10_00_000_00),
    ("ACC1010", "Nisha Gupta", 10_00_000_00),
    ("ACC1011", "Arjun Desai", 10_00_000_00),
    ("ACC1012", "Tanvi Joshi", 10_00_000_00),
    ("ACC1013", "Karan Malhotra", 10_00_000_00),
    ("ACC1014", "Isha Reddy", 10_00_000_00),
    ("ACC1015", "Manav Bose", 10_00_000_00),
]

# (source, destination, amount_paise, minutes_ago, description)
DEMO_TRANSACTIONS: List[Tuple[str, str, int, int, str]] = [
    # --- normal banking activity -------------------------------------
    ("ACC1001", "ACC1002", 25_00_000, 3 * 24 * 60, "Salary settlement"),
    ("ACC1002", "ACC1003", 18_00_000, 2 * 24 * 60 + 120, "Vendor payment"),
    ("ACC1005", "ACC1006", 9_00_000, 2 * 24 * 60 + 600, "Invoice payment"),
    ("ACC1006", "ACC1009", 7_50_000, 2 * 24 * 60, "Utility payment"),
    ("ACC1009", "ACC1010", 6_00_000, 36 * 60, "Rent transfer"),
    ("ACC1001", "ACC1005", 10_00_000, 6 * 60, "Loan repayment"),
    ("ACC1002", "ACC1006", 8_00_000, 7 * 60, "Consulting fee"),
    ("ACC1003", "ACC1010", 6_50_000, 9 * 60, "Supplier payment"),
    ("ACC1010", "ACC1012", 4_00_000, 10 * 60, "Equipment purchase"),
    ("ACC1001", "ACC1003", 2_00_000, 11 * 60, "Reimbursement"),
    ("ACC1004", "ACC1006", 2_50_000, 12 * 60, "Small transfer"),
    ("ACC1012", "ACC1010", 1_50_000, 13 * 60, "Refund"),

    # --- transaction chain: 1001 -> 1002 -> 1003 -> 1004 -> 1005 -> 1006 -> ...
    ("ACC1003", "ACC1004", 12_00_000, 24 * 60 + 480, "Layered transfer 1"),
    ("ACC1004", "ACC1005", 11_00_000, 24 * 60 + 360, "Layered transfer 2"),

    # --- circular flow: 1011 -> 1012 -> 1013 -> 1011 -----------------
    ("ACC1011", "ACC1012", 50_00_000, 24 * 60, "Round-trip leg 1"),
    ("ACC1012", "ACC1013", 48_00_000, 20 * 60, "Round-trip leg 2"),
    ("ACC1013", "ACC1011", 47_00_000, 18 * 60, "Round-trip leg 3"),

    # --- rapid movement (all inside a 2 hour window) ----------------
    ("ACC1006", "ACC1007", 5_00_000, 100, "Urgent sweep 1"),
    ("ACC1007", "ACC1008", 4_80_000, 90, "Urgent sweep 2"),
    ("ACC1008", "ACC1009", 4_60_000, 80, "Urgent sweep 3"),
    ("ACC1009", "ACC1006", 4_40_000, 70, "Urgent sweep 4"),

    # --- high-value transfer ----------------------------------------
    ("ACC1008", "ACC1012", 5_00_00_000, 36 * 60, "Property advance"),

    # --- intermediary account ACC1007 -------------------------------
    ("ACC1005", "ACC1007", 3_00_000, 5 * 60, "Aggregation in 1"),
    ("ACC1010", "ACC1007", 3_50_000, 4 * 60, "Aggregation in 2"),
    ("ACC1007", "ACC1011", 3_20_000, 3 * 60, "Distribution out 1"),
    ("ACC1007", "ACC1013", 3_30_000, 2 * 60, "Distribution out 2"),

    # --- disconnected component: ACC1014 <-> ACC1015 ----------------
    ("ACC1014", "ACC1015", 7_00_000, 30 * 60, "Standalone transfer"),
    ("ACC1015", "ACC1014", 6_50_000, 28 * 60, "Standalone return"),
]


def clear_session_data(db: DBSession, session_id: str) -> None:
    """Remove every account, transaction, investigation and finding for a session."""
    db.query(Finding).filter(Finding.session_id == session_id).delete(synchronize_session=False)
    db.query(Investigation).filter(Investigation.session_id == session_id).delete(synchronize_session=False)
    db.query(Transaction).filter(Transaction.session_id == session_id).delete(synchronize_session=False)
    db.query(Account).filter(Account.session_id == session_id).delete(synchronize_session=False)
    db.commit()


def seed_demo_data(db: DBSession, session_id: str) -> dict:
    """
    Replace the session's workspace with the synthetic demo dataset.

    Returns a small summary used by the reset endpoint.
    """
    clear_session_data(db, session_id)

    now = datetime.utcnow()
    numbers_to_accounts = {}

    # 1. Create accounts
    for number, holder, opening in DEMO_ACCOUNTS:
        account = Account(
            session_id=session_id,
            account_number=number,
            account_holder=holder,
            balance=opening,
            created_at=now,
            is_active=True,
        )
        db.add(account)
        numbers_to_accounts[number] = account

    db.flush()  # assign primary keys

    balance = {number: opening for number, _, opening in DEMO_ACCOUNTS}

    # 2. Create transactions in chronological order
    for index, (src, dst, amount, minutes_ago, description) in enumerate(DEMO_TRANSACTIONS, start=1):
        source = numbers_to_accounts[src]
        destination = numbers_to_accounts[dst]
        db.add(
            Transaction(
                session_id=session_id,
                transaction_id=f"TX{index:04d}",
                source_account_id=source.id,
                destination_account_id=destination.id,
                amount=amount,
                transaction_type="transfer",
                timestamp=now - timedelta(minutes=minutes_ago),
                description=description,
                is_fraudulent=False,
            )
        )
        balance[src] -= amount
        balance[dst] += amount

    # 3. Persist the net balances (never below zero)
    for number, account in numbers_to_accounts.items():
        account.balance = max(balance[number], 0)

    db.commit()

    return {
        "accounts": len(DEMO_ACCOUNTS),
        "transactions": len(DEMO_TRANSACTIONS),
    }
