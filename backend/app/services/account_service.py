from sqlalchemy.orm import Session as DBSession
from ..models import Account, Session
from ..schemas import (
    AccountCreate, AccountResponse, AccountUpdate, AccountSearch
)
from ..graph import Graph, Transaction
from typing import List, Optional
from datetime import datetime

class AccountService:
    """
    Service for managing account operations.
    
    Provides CRUD operations for accounts and integrates with graph operations.
    """
    
    def __init__(self, db: DBSession):
        self.db = db
    
    def create_account(self, session_id: str, account_data: AccountCreate) -> AccountResponse:
        """
        Create a new account.
        
        Args:
            session_id: Session identifier
            account_data: Account creation data
            
        Returns:
            Created account response
            
        Raises:
            ValueError: If session doesn't exist or account number already exists
        """
        # Validate session exists
        session = self.db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        # Account numbers are unique per workspace, not globally.
        existing = self.db.query(Account).filter(
            Account.session_id == session_id,
            Account.account_number == account_data.account_number,
        ).first()
        if existing:
            raise ValueError(f"Account number already exists: {account_data.account_number}")
        
        # Create account
        db_account = Account(
            session_id=session_id,
            account_number=account_data.account_number,
            account_holder=account_data.account_holder,
            balance=account_data.balance
        )
        
        self.db.add(db_account)
        self.db.commit()
        self.db.refresh(db_account)
        
        return AccountResponse(
            id=db_account.id,
            session_id=db_account.session_id,
            account_number=db_account.account_number,
            account_holder=db_account.account_holder,
            balance=db_account.balance,
            created_at=db_account.created_at,
            is_active=db_account.is_active
        )
    
    def get_account(self, session_id: str, account_id: int) -> AccountResponse:
        """
        Get account by ID.
        
        Args:
            session_id: Session identifier
            account_id: Account identifier
            
        Returns:
            Account response
            
        Raises:
            ValueError: If account doesn't exist or doesn't belong to session
        """
        db_account = self.db.query(Account).filter(
            Account.id == account_id,
            Account.session_id == session_id
        ).first()
        
        if not db_account:
            raise ValueError(f"Account not found: {account_id}")
        
        return AccountResponse(
            id=db_account.id,
            session_id=db_account.session_id,
            account_number=db_account.account_number,
            account_holder=db_account.account_holder,
            balance=db_account.balance,
            created_at=db_account.created_at,
            is_active=db_account.is_active
        )
    
    def list_accounts(self, session_id: str, search_params: Optional[AccountSearch] = None) -> List[AccountResponse]:
        """
        List accounts for a session with optional search filters.
        
        Args:
            session_id: Session identifier
            search_params: Optional search parameters
            
        Returns:
            List of account responses
        """
        query = self.db.query(Account).filter(Account.session_id == session_id)
        
        if search_params:
            if search_params.account_number:
                query = query.filter(Account.account_number.like(f"%{search_params.account_number}%"))
            if search_params.account_holder:
                query = query.filter(Account.account_holder.like(f"%{search_params.account_holder}%"))
            if search_params.is_active is not None:
                query = query.filter(Account.is_active == search_params.is_active)
        
        accounts = query.offset(search_params.offset if search_params else 0).limit(
            search_params.limit if search_params else 10
        ).all()
        
        return [
            AccountResponse(
                id=account.id,
                session_id=account.session_id,
                account_number=account.account_number,
                account_holder=account.account_holder,
                balance=account.balance,
                created_at=account.created_at,
                is_active=account.is_active
            ) for account in accounts
        ]
    
    def update_account(self, session_id: str, account_id: int, account_data: AccountUpdate) -> AccountResponse:
        """
        Update an existing account.
        
        Args:
            session_id: Session identifier
            account_id: Account identifier
            account_data: Account update data
            
        Returns:
            Updated account response
            
        Raises:
            ValueError: If account doesn't exist or doesn't belong to session
        """
        db_account = self.db.query(Account).filter(
            Account.id == account_id,
            Account.session_id == session_id
        ).first()
        
        if not db_account:
            raise ValueError(f"Account not found: {account_id}")
        
        if account_data.account_holder is not None:
            db_account.account_holder = account_data.account_holder
        if account_data.balance is not None:
            db_account.balance = account_data.balance
        if account_data.is_active is not None:
            db_account.is_active = account_data.is_active
        
        self.db.commit()
        self.db.refresh(db_account)
        
        return AccountResponse(
            id=db_account.id,
            session_id=db_account.session_id,
            account_number=db_account.account_number,
            account_holder=db_account.account_holder,
            balance=db_account.balance,
            created_at=db_account.created_at,
            is_active=db_account.is_active
        )
    
    def delete_account(self, session_id: str, account_id: int) -> bool:
        """
        Delete an account.
        
        Args:
            session_id: Session identifier
            account_id: Account identifier
            
        Returns:
            True if account was deleted, False otherwise
        """
        db_account = self.db.query(Account).filter(
            Account.id == account_id,
            Account.session_id == session_id
        ).first()
        
        if not db_account:
            return False
        
        self.db.delete(db_account)
        self.db.commit()
        return True
    
    def search_account(self, session_id: str, account_number: str) -> Optional[AccountResponse]:
        """
        Search for an account by account number.
        
        Args:
            session_id: Session identifier
            account_number: Account number to search for
            
        Returns:
            Account response if found, None otherwise
        """
        db_account = self.db.query(Account).filter(
            Account.session_id == session_id,
            Account.account_number == account_number
        ).first()
        
        if not db_account:
            return None
        
        return AccountResponse(
            id=db_account.id,
            session_id=db_account.session_id,
            account_number=db_account.account_number,
            account_holder=db_account.account_holder,
            balance=db_account.balance,
            created_at=db_account.created_at,
            is_active=db_account.is_active
        )