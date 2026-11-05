from sqlalchemy.orm import Session as DBSession
from ..models import Account, Transaction, Session, Investigation, Finding
from ..schemas import (
    AccountCreate, TransactionCreate, AccountResponse, TransactionResponse,
    GraphData, DFSResult, InvestigationCreate, InvestigationResponse,
    FindingCreate, FindingResponse
)
from ..graph import Graph, Transaction as GraphTransaction
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

class GraphService:
    """
    Service for managing graph operations and integration with the database.
    
    Provides methods to sync database data with the in-memory graph implementation
    and execute graph algorithms for investigations.
    """
    
    def __init__(self, db: DBSession):
        self.db = db
        self.graph = Graph()
    
    def sync_graph_from_session(self, session_id: str):
        """
        Sync the in-memory graph with the current session data.
        
        Args:
            session_id: Session identifier for scoping
        """
        # Clear existing graph
        self.graph = Graph()
        
        # Get accounts and transactions for the session
        accounts = self.db.query(Account).filter(Account.session_id == session_id).all()
        transactions = self.db.query(Transaction).filter(Transaction.session_id == session_id).all()
        
        # Add accounts to graph
        for account in accounts:
            self.graph.add_account(account.account_number)
        
        # Add transactions to graph
        for transaction in transactions:
            # Get source and destination account numbers
            source_account = self.db.query(Account).filter(Account.id == transaction.source_account_id).first()
            dest_account = self.db.query(Account).filter(Account.id == transaction.destination_account_id).first()
            
            if source_account and dest_account:
                graph_transaction = GraphTransaction(
                    transaction_id=transaction.transaction_id,
                    source_account=source_account.account_number,
                    destination_account=dest_account.account_number,
                    amount=transaction.amount,
                    timestamp=transaction.timestamp.timestamp() if transaction.timestamp else datetime.utcnow().timestamp()
                )
                self.graph.add_transaction(graph_transaction)
    
    def get_graph_data(self, session_id: str) -> Dict[str, Any]:
        """
        Get graph data for frontend visualization.
        
        Args:
            session_id: Session identifier for scoping
            
        Returns:
            Dictionary containing accounts, transactions, and adjacency list
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        # Get accounts data
        accounts = self.db.query(Account).filter(Account.session_id == session_id).all()
        account_list = []
        
        for account in accounts:
            account_list.append({
                "id": account.account_number,
                "name": account.account_holder,
                "balance": account.balance,
                "is_active": account.is_active,
                "transaction_count": len(self.graph.get_account_transactions(account.account_number))
            })
        
        # Get transactions data
        transactions = self.db.query(Transaction).filter(Transaction.session_id == session_id).all()
        transaction_list = []
        
        for transaction in transactions:
            source_account = self.db.query(Account).filter(Account.id == transaction.source_account_id).first()
            dest_account = self.db.query(Account).filter(Account.id == transaction.destination_account_id).first()
            
            if source_account and dest_account:
                transaction_list.append({
                    "id": transaction.transaction_id,
                    "source": source_account.account_number,
                    "destination": dest_account.account_number,
                    "amount": transaction.amount,
                    "timestamp": transaction.timestamp.isoformat(),
                    "type": transaction.transaction_type,
                    "description": transaction.description
                })
        
        # Get adjacency list
        adjacency_list = self.graph.get_adjacency_list()
        
        return {
            "accounts": account_list,
            "transactions": transaction_list,
            "adjacency_list": adjacency_list,
            "stats": {
                "account_count": len(account_list),
                "transaction_count": len(transaction_list),
                "is_connected": self.graph.is_connected(),
                "component_count": len(self.graph.get_connected_components())
            }
        }
    
    def add_account_to_graph(self, session_id: str, account_data: AccountCreate) -> AccountResponse:
        """
        Add an account to the graph and database.
        
        Args:
            session_id: Session identifier for scoping
            account_data: Account creation data
            
        Returns:
            Created account response
        """
        from .account_service import AccountService
        account_service = AccountService(self.db)
        
        # Create account in database
        db_account = account_service.create_account(session_id, account_data)
        
        # Add to graph
        self.graph.add_account(db_account.account_number)
        
        return db_account
    
    def remove_account_from_graph(self, session_id: str, account_id: str) -> bool:
        """
        Remove an account from the graph and database.
        
        Args:
            session_id: Session identifier for scoping
            account_id: Account ID to remove
            
        Returns:
            True if account was removed, False otherwise
        """
        # Find account in database
        db_account = self.db.query(Account).filter(
            Account.session_id == session_id,
            Account.account_number == account_id
        ).first()
        
        if not db_account:
            return False
        
        # Remove from graph
        removed = self.graph.remove_account(account_id)
        
        # Remove from database
        self.db.delete(db_account)
        self.db.commit()
        
        return removed
    
    def add_transaction_to_graph(self, session_id: str, transaction_data: TransactionCreate) -> TransactionResponse:
        """
        Add a transaction to the graph and database.
        
        Args:
            session_id: Session identifier for scoping
            transaction_data: Transaction creation data
            
        Returns:
            Created transaction response
        """
        from .transaction_service import TransactionService
        transaction_service = TransactionService(self.db)
        
        # Create transaction in database
        db_transaction = transaction_service.create_transaction(session_id, transaction_data)
        
        # Get source and destination account numbers
        source_account = self.db.query(Account).filter(Account.id == transaction_data.source_account_id).first()
        dest_account = self.db.query(Account).filter(Account.id == transaction_data.destination_account_id).first()
        
        if source_account and dest_account:
            # Add to graph
            graph_transaction = GraphTransaction(
                transaction_id=db_transaction.transaction_id,
                source_account=source_account.account_number,
                destination_account=dest_account.account_number,
                amount=db_transaction.amount,
                timestamp=db_transaction.timestamp.timestamp() if db_transaction.timestamp else datetime.utcnow().timestamp()
            )
            self.graph.add_transaction(graph_transaction)
        
        return db_transaction
    
    def remove_transaction_from_graph(self, session_id: str, transaction_id: str) -> bool:
        """
        Remove a transaction from the graph and database.
        
        Args:
            session_id: Session identifier for scoping
            transaction_id: Transaction ID to remove
            
        Returns:
            True if transaction was removed, False otherwise
        """
        # Find transaction in database
        db_transaction = self.db.query(Transaction).filter(
            Transaction.session_id == session_id,
            Transaction.transaction_id == transaction_id
        ).first()
        
        if not db_transaction:
            return False
        
        # Get account numbers for graph removal
        source_account = self.db.query(Account).filter(Account.id == db_transaction.source_account_id).first()
        dest_account = self.db.query(Account).filter(Account.id == db_transaction.destination_account_id).first()
        
        # Remove from graph
        removed = self.graph.remove_transaction(transaction_id)
        
        # Remove from database
        self.db.delete(db_transaction)
        self.db.commit()
        
        return removed
    
    def search_graph_account(self, session_id: str, account_number: str) -> Optional[AccountResponse]:
        """
        Search for an account in both graph and database.
        
        Args:
            session_id: Session identifier for scoping
            account_number: Account number to search for
            
        Returns:
            Account response if found, None otherwise
        """
        from .account_service import AccountService
        account_service = AccountService(self.db)
        
        return account_service.search_account(session_id, account_number)
    
    def get_account_neighbors(self, session_id: str, account_id: str) -> List[str]:
        """
        Get neighboring accounts for a given account.
        
        Args:
            session_id: Session identifier for scoping
            account_id: Account ID to find neighbors for
            
        Returns:
            List of neighboring account IDs
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        return self.graph.find_neighbors(account_id)
    
    def get_reachable_accounts(self, session_id: str, start_account: str) -> List[str]:
        """
        Get all accounts reachable from a starting account.
        
        Args:
            session_id: Session identifier for scoping
            start_account: Starting account ID
            
        Returns:
            List of reachable account IDs
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        return self.graph.find_reachable_accounts(start_account)
    
    def run_dfs(self, session_id: str, start_account: str) -> DFSResult:
        """
        Run DFS algorithm and return results.
        
        Args:
            session_id: Session identifier for scoping
            start_account: Starting account ID
            
        Returns:
            DFS traversal results
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        # Run DFS
        traversal_order, visited_accounts = self.graph.iterative_dfs(start_account)
        
        return DFSResult(
            start_account=start_account,
            traversal_order=traversal_order,
            visited=visited_accounts,
            adjacency_list=self.graph.get_adjacency_list(),
            time_complexity="O(V + E)",  # Vertices + Edges
            space_complexity="O(V)"       # Vertices (for stack and visited set)
        )
    
    def get_connected_components(self, session_id: str) -> List[List[str]]:
        """
        Get connected components in the graph.
        
        Args:
            session_id: Session identifier for scoping
            
        Returns:
            List of connected components
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        return self.graph.get_connected_components()
    
    def detect_cycles(self, session_id: str) -> List[List[str]]:
        """
        Detect cycles in the graph.
        
        Args:
            session_id: Session identifier for scoping
            
        Returns:
            List of cycles found
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        return self.graph.detect_cycles()
    
    def check_graph_connected(self, session_id: str) -> bool:
        """
        Check if the graph is connected.
        
        Args:
            session_id: Session identifier for scoping
            
        Returns:
            True if graph is connected, False otherwise
        """
        # Sync graph if needed
        self.sync_graph_from_session(session_id)
        
        return self.graph.is_connected()