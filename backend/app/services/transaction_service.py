from sqlalchemy.orm import Session as DBSession
from ..models import Transaction, Account, Session
from ..schemas import (
    TransactionCreate, TransactionResponse, TransactionUpdate, TransactionSearch
)
from ..graph import Graph, Transaction as GraphTransaction
from typing import List, Optional
from datetime import datetime
import uuid

class TransactionService:
    """
    Service for managing transaction operations.
    
    Provides CRUD operations for transactions and integrates with graph operations.
    """
    
    def __init__(self, db: DBSession):
        self.db = db
    
    def create_transaction(self, session_id: str, transaction_data: TransactionCreate) -> TransactionResponse:
        """
        Create a new transaction.
        
        Args:
            session_id: Session identifier
            transaction_data: Transaction creation data
            
        Returns:
            Created transaction response
            
        Raises:
            ValueError: If session, source account, or destination account doesn't exist
        """
        # Validate session exists
        session = self.db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        # Validate source and destination accounts exist
        source_account = self.db.query(Account).filter(
            Account.id == transaction_data.source_account_id,
            Account.session_id == session_id
        ).first()
        
        dest_account = self.db.query(Account).filter(
            Account.id == transaction_data.destination_account_id,
            Account.session_id == session_id
        ).first()
        
        if not source_account:
            raise ValueError(f"Source account not found: {transaction_data.source_account_id}")
        
        if not dest_account:
            raise ValueError(f"Destination account not found: {transaction_data.destination_account_id}")
        
        # Validate transaction amount
        if transaction_data.amount <= 0:
            raise ValueError("Transaction amount must be greater than 0")
        
        # Check if source account has sufficient balance
        if source_account.balance < transaction_data.amount:
            raise ValueError(f"Insufficient balance in source account {source_account.account_number}")
        
        # Create transaction
        transaction_id = str(uuid.uuid4())
        timestamp = transaction_data.timestamp or datetime.utcnow()
        
        db_transaction = Transaction(
            session_id=session_id,
            transaction_id=transaction_id,
            source_account_id=transaction_data.source_account_id,
            destination_account_id=transaction_data.destination_account_id,
            amount=transaction_data.amount,
            transaction_type=transaction_data.transaction_type,
            timestamp=timestamp,
            description=transaction_data.description,
            is_fraudulent=False
        )
        
        self.db.add(db_transaction)
        self.db.commit()
        self.db.refresh(db_transaction)
        
        # Update account balances
        source_account.balance -= transaction_data.amount
        dest_account.balance += transaction_data.amount
        self.db.commit()
        
        return TransactionResponse(
            id=db_transaction.id,
            session_id=db_transaction.session_id,
            transaction_id=db_transaction.transaction_id,
            source_account_id=db_transaction.source_account_id,
            destination_account_id=db_transaction.destination_account_id,
            amount=db_transaction.amount,
            transaction_type=db_transaction.transaction_type,
            timestamp=db_transaction.timestamp,
            description=db_transaction.description,
            is_fraudulent=db_transaction.is_fraudulent
        )
    
    def get_transaction(self, session_id: str, transaction_id: int) -> TransactionResponse:
        """
        Get transaction by ID.
        
        Args:
            session_id: Session identifier
            transaction_id: Transaction identifier
            
        Returns:
            Transaction response
            
        Raises:
            ValueError: If transaction doesn't exist or doesn't belong to session
        """
        db_transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.session_id == session_id
        ).first()
        
        if not db_transaction:
            raise ValueError(f"Transaction not found: {transaction_id}")
        
        return TransactionResponse(
            id=db_transaction.id,
            session_id=db_transaction.session_id,
            transaction_id=db_transaction.transaction_id,
            source_account_id=db_transaction.source_account_id,
            destination_account_id=db_transaction.destination_account_id,
            amount=db_transaction.amount,
            transaction_type=db_transaction.transaction_type,
            timestamp=db_transaction.timestamp,
            description=db_transaction.description,
            is_fraudulent=db_transaction.is_fraudulent
        )
    
    def list_transactions(self, session_id: str, search_params: Optional[TransactionSearch] = None) -> List[TransactionResponse]:
        """
        List transactions for a session with optional search filters.
        
        Args:
            session_id: Session identifier
            search_params: Optional search parameters
            
        Returns:
            List of transaction responses
        """
        query = self.db.query(Transaction).filter(Transaction.session_id == session_id)
        
        if search_params:
            if search_params.source_account_id:
                query = query.filter(Transaction.source_account_id == search_params.source_account_id)
            if search_params.destination_account_id:
                query = query.filter(Transaction.destination_account_id == search_params.destination_account_id)
            if search_params.transaction_type:
                query = query.filter(Transaction.transaction_type == search_params.transaction_type)
            if search_params.start_date:
                query = query.filter(Transaction.timestamp >= search_params.start_date)
            if search_params.end_date:
                query = query.filter(Transaction.timestamp <= search_params.end_date)
            if search_params.min_amount:
                query = query.filter(Transaction.amount >= search_params.min_amount)
            if search_params.max_amount:
                query = query.filter(Transaction.amount <= search_params.max_amount)
        
        transactions = query.offset(search_params.offset if search_params else 0).limit(
            search_params.limit if search_params else 10
        ).all()
        
        return [
            TransactionResponse(
                id=transaction.id,
                session_id=transaction.session_id,
                transaction_id=transaction.transaction_id,
                source_account_id=transaction.source_account_id,
                destination_account_id=transaction.destination_account_id,
                amount=transaction.amount,
                transaction_type=transaction.transaction_type,
                timestamp=transaction.timestamp,
                description=transaction.description,
                is_fraudulent=transaction.is_fraudulent
            ) for transaction in transactions
        ]
    
    def update_transaction(self, session_id: str, transaction_id: int, transaction_data: TransactionUpdate) -> TransactionResponse:
        """
        Update an existing transaction.
        
        Args:
            session_id: Session identifier
            transaction_id: Transaction identifier
            transaction_data: Transaction update data
            
        Returns:
            Updated transaction response
            
        Raises:
            ValueError: If transaction doesn't exist or doesn't belong to session
        """
        db_transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.session_id == session_id
        ).first()
        
        if not db_transaction:
            raise ValueError(f"Transaction not found: {transaction_id}")
        
        if transaction_data.description is not None:
            db_transaction.description = transaction_data.description
        if transaction_data.is_fraudulent is not None:
            db_transaction.is_fraudulent = transaction_data.is_fraudulent
        
        self.db.commit()
        self.db.refresh(db_transaction)
        
        return TransactionResponse(
            id=db_transaction.id,
            session_id=db_transaction.session_id,
            transaction_id=db_transaction.transaction_id,
            source_account_id=db_transaction.source_account_id,
            destination_account_id=db_transaction.destination_account_id,
            amount=db_transaction.amount,
            transaction_type=db_transaction.transaction_type,
            timestamp=db_transaction.timestamp,
            description=db_transaction.description,
            is_fraudulent=db_transaction.is_fraudulent
        )
    
    def delete_transaction(self, session_id: str, transaction_id: int) -> bool:
        """
        Delete a transaction.
        
        Args:
            session_id: Session identifier
            transaction_id: Transaction identifier
            
        Returns:
            True if transaction was deleted, False otherwise
        """
        db_transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.session_id == session_id
        ).first()
        
        if not db_transaction:
            return False
        
        # Update account balances back (for reversal)
        source_account = self.db.query(Account).filter(Account.id == db_transaction.source_account_id).first()
        dest_account = self.db.query(Account).filter(Account.id == db_transaction.destination_account_id).first()
        
        if source_account:
            source_account.balance += db_transaction.amount
        if dest_account:
            dest_account.balance -= db_transaction.amount
        
        self.db.delete(db_transaction)
        self.db.commit()
        return True