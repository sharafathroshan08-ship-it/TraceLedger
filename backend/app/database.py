from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import os
import uuid
from datetime import datetime, timedelta

# SQLite database file. Deployment can override with a PostgreSQL URL
# through TRACELEDGER_DATABASE_URL (e.g. a Supabase connection string).
DATABASE_URL = os.getenv("TRACELEDGER_DATABASE_URL", "sqlite:///./traceledger.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Session table for tracking independent user sessions
class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    accounts = relationship("Account", back_populates="session")
    transactions = relationship("Transaction", back_populates="session")
    investigations = relationship("Investigation", back_populates="session")
    findings = relationship("Finding", back_populates="session")

# Account model
class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("session_id", "account_number", name="uq_account_per_session"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), index=True)
    account_number = Column(String, index=True)
    account_holder = Column(String)
    balance = Column(Integer, default=0)  # Stored in paise (1/100 of currency unit)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    session = relationship("Session", back_populates="accounts")
    outgoing_transactions = relationship(
        "Transaction", 
        foreign_keys="Transaction.source_account_id",
        back_populates="source_account"
    )
    incoming_transactions = relationship(
        "Transaction", 
        foreign_keys="Transaction.destination_account_id",
        back_populates="destination_account"
    )
    investigations = relationship("Investigation", back_populates="start_account")

# Transaction model
class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("session_id", "transaction_id", name="uq_transaction_per_session"),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), index=True)
    transaction_id = Column(String, index=True)
    source_account_id = Column(Integer, ForeignKey("accounts.id"))
    destination_account_id = Column(Integer, ForeignKey("accounts.id"))
    amount = Column(Integer)  # Stored in paise
    transaction_type = Column(String)  # "transfer", "deposit", "withdrawal"
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(String)
    is_fraudulent = Column(Boolean, default=False)
    
    # Relationships
    session = relationship("Session", back_populates="transactions")
    source_account = relationship(
        "Account", 
        foreign_keys="Transaction.source_account_id",
        back_populates="outgoing_transactions"
    )
    destination_account = relationship(
        "Account", 
        foreign_keys="Transaction.destination_account_id",
        back_populates="incoming_transactions"
    )
    findings = relationship("Finding", back_populates="transaction")

# Investigation model
class Investigation(Base):
    __tablename__ = "investigations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    start_account_id = Column(Integer, ForeignKey("accounts.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    dfs_traversal = Column(Text)  # JSON string of DFS traversal
    suspicious_patterns = Column(Text)  # JSON string of suspicious patterns
    report_generated = Column(Boolean, default=False)
    
    # Relationships
    session = relationship("Session", back_populates="investigations")
    start_account = relationship("Account", back_populates="investigations")
    findings = relationship("Finding", back_populates="investigation")

# Finding model
class Finding(Base):
    __tablename__ = "findings"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    investigation_id = Column(Integer, ForeignKey("investigations.id"), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    finding_type = Column(String)  # "transaction_chain", "circular_transaction", etc.
    severity = Column(String)  # "low", "medium", "high", "critical"
    description = Column(String)
    evidence = Column(Text)  # JSON string of evidence
    detected_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="findings")
    investigation = relationship("Investigation", back_populates="findings")
    transaction = relationship("Transaction", back_populates="findings")