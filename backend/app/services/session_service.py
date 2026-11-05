from sqlalchemy.orm import Session as DBSession
from ..models import Session
from ..schemas import SessionCreate, SessionResponse
from datetime import datetime, timedelta
import uuid

class SessionService:
    """
    Service for managing user sessions and session lifecycle.
    
    Provides session creation, validation, and cleanup with automatic expiration.
    """
    
    def __init__(self, db: DBSession):
        self.db = db
    
    def create_session(self) -> SessionResponse:
        """
        Create a new user session.
        
        Returns:
            Created session response
        """
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        db_session = Session(
            id=session_id,
            expires_at=expires_at,
            is_active=True
        )
        
        self.db.add(db_session)
        self.db.commit()
        self.db.refresh(db_session)
        
        return SessionResponse(
            id=db_session.id,
            created_at=db_session.created_at,
            expires_at=db_session.expires_at,
            is_active=db_session.is_active
        )
    
    def get_session_info(self, session_id: str) -> SessionResponse:
        """
        Get session information by ID.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session response
            
        Raises:
            HTTPException: If session not found
        """
        db_session = self.db.query(Session).filter(Session.id == session_id).first()
        if not db_session:
            raise ValueError(f"Session not found: {session_id}")
        
        return SessionResponse(
            id=db_session.id,
            created_at=db_session.created_at,
            expires_at=db_session.expires_at,
            is_active=db_session.is_active
        )
    
    def validate_session(self, session_id: str) -> bool:
        """
        Validate if a session exists and is still active.
        
        Args:
            session_id: Session identifier to validate
            
        Returns:
            True if session is valid, False otherwise
        """
        db_session = self.db.query(Session).filter(
            Session.id == session_id,
            Session.is_active == True,
            Session.expires_at > datetime.utcnow()
        ).first()
        
        return db_session is not None
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.
        
        Args:
            session_id: Session identifier to delete
            
        Returns:
            True if session was deleted, False otherwise
        """
        db_session = self.db.query(Session).filter(Session.id == session_id).first()
        if not db_session:
            return False
        
        self.db.delete(db_session)
        self.db.commit()
        return True
    
    def cleanup_expired_sessions(self):
        """
        Clean up expired sessions from the database.
        """
        expired_sessions = self.db.query(Session).filter(
            Session.expires_at <= datetime.utcnow()
        ).all()
        
        for session in expired_sessions:
            self.db.delete(session)
        
        self.db.commit()