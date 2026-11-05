"""Pydantic request / response models."""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------------------------
# Sessions
# ----------------------------------------------------------------------
class SessionCreate(BaseModel):
    pass


class SessionResponse(ORMModel):
    id: str
    created_at: datetime
    expires_at: datetime
    is_active: bool


class SessionInfo(BaseModel):
    id: str
    accounts_count: int
    transactions_count: int
    investigations_count: int


# ----------------------------------------------------------------------
# Accounts
# ----------------------------------------------------------------------
class AccountCreate(BaseModel):
    account_number: str = Field(..., min_length=5, max_length=20)
    account_holder: str = Field(..., min_length=2, max_length=100)
    balance: int = Field(default=0, ge=0)

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, value: str) -> str:
        value = value.strip().upper()
        if not re.match(r"^[A-Z0-9]{5,20}$", value):
            raise ValueError("Account number must be 5-20 alphanumeric characters")
        return value


class AccountResponse(ORMModel):
    id: int
    session_id: str
    account_number: str
    account_holder: str
    balance: int
    created_at: datetime
    is_active: bool


class AccountUpdate(BaseModel):
    account_holder: Optional[str] = Field(None, min_length=2, max_length=100)
    balance: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class AccountSearch(BaseModel):
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    is_active: Optional[bool] = None
    limit: int = Field(default=10, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


# ----------------------------------------------------------------------
# Transactions
# ----------------------------------------------------------------------
class TransactionCreate(BaseModel):
    source_account_id: int
    destination_account_id: int
    amount: int = Field(..., gt=0, description="Amount in paise")
    transaction_type: str = Field(default="transfer", pattern="^(transfer|deposit|withdrawal)$")
    description: Optional[str] = None
    timestamp: Optional[datetime] = None


class TransactionResponse(ORMModel):
    id: int
    session_id: str
    transaction_id: str
    source_account_id: int
    destination_account_id: int
    amount: int
    transaction_type: str
    timestamp: datetime
    description: Optional[str] = None
    is_fraudulent: bool


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    is_fraudulent: Optional[bool] = None


class TransactionSearch(BaseModel):
    source_account_id: Optional[int] = None
    destination_account_id: Optional[int] = None
    transaction_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_amount: Optional[int] = None
    max_amount: Optional[int] = None
    limit: int = Field(default=10, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


# ----------------------------------------------------------------------
# Graph / DFS
# ----------------------------------------------------------------------
class GraphData(BaseModel):
    accounts: List[Dict[str, Any]]
    transactions: List[Dict[str, Any]]
    adjacency_list: Dict[str, List[str]]


class DFSResult(BaseModel):
    start_account: str
    traversal_order: List[str]
    visited: List[str]
    adjacency_list: Dict[str, List[str]]
    time_complexity: str
    space_complexity: str


# ----------------------------------------------------------------------
# Investigations / findings
# ----------------------------------------------------------------------
class InvestigationCreate(BaseModel):
    start_account_id: int


class InvestigationResponse(ORMModel):
    id: int
    session_id: str
    start_account_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    dfs_traversal: Optional[Dict[str, Any]] = None
    suspicious_patterns: Optional[Dict[str, Any]] = None
    report_generated: bool


class FindingCreate(BaseModel):
    finding_type: str
    severity: str = Field(pattern="^(low|medium|high|critical)$")
    description: str
    transaction_id: Optional[int] = None
    evidence: Optional[Dict[str, Any]] = None


class FindingResponse(ORMModel):
    id: int
    session_id: str
    investigation_id: Optional[int] = None
    finding_type: str
    severity: str
    description: str
    transaction_id: Optional[int] = None
    evidence: Optional[Dict[str, Any]] = None
    detected_at: datetime
