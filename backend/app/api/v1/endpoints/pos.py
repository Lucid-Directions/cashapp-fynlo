"""
POS Session Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user, User
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes

router = APIRouter()

# Pydantic models for POS Session
class PosSessionCreate(BaseModel):
    config_id: int
    name: Optional[str] = None

class PosSessionResponse(BaseModel):
    id: int
    name: str
    state: str  # 'opening_control' | 'opened' | 'closing_control' | 'closed'
    start_at: str
    stop_at: Optional[str] = None
    config_id: int
    config_name: str
    user_id: int
    user_name: str

# Temporary POS Session storage (until database model is added)
pos_sessions = {}
session_counter = 1

@router.get("/sessions/current")
async def get_current_session(
    current_user: User = Depends(get_current_user)
):
    """Get the current active POS session"""
    
    # Find the active session for this user
    active_session = None
    for session_id, session in pos_sessions.items():
        if session["user_id"] == current_user.id and session["state"] in ["opening_control", "opened"]:
            active_session = session
            break
    
    if not active_session:
        return APIResponseHelper.success(
            data=None,
            message="No active POS session found"
        )
    
    return APIResponseHelper.success(
        data=active_session,
        message="Current POS session retrieved successfully"
    )

@router.post("/sessions")
async def create_session(
    session_data: PosSessionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new POS session"""
    
    global session_counter
    
    # Check if user already has an active session
    for session_id, session in pos_sessions.items():
        if session["user_id"] == current_user.id and session["state"] in ["opening_control", "opened"]:
            raise HTTPException(
                status_code=400,
                detail="User already has an active POS session"
            )
    
    # Create new session
    new_session = {
        "id": session_counter,
        "name": session_data.name or f"POS Session {session_counter}",
        "state": "opening_control",
        "start_at": datetime.utcnow().isoformat(),
        "stop_at": None,
        "config_id": session_data.config_id,
        "config_name": f"POS Config {session_data.config_id}",
        "user_id": current_user.id,
        "user_name": current_user.username or current_user.email
    }
    
    pos_sessions[session_counter] = new_session
    session_counter += 1
    
    return APIResponseHelper.success(
        data=new_session,
        message="POS session created successfully"
    )

@router.put("/sessions/{session_id}/state")
async def update_session_state(
    session_id: int,
    state: str,
    current_user: User = Depends(get_current_user)
):
    """Update POS session state"""
    
    if session_id not in pos_sessions:
        raise HTTPException(status_code=404, detail="POS session not found")
    
    session = pos_sessions[session_id]
    
    # Check if user owns this session
    if session["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this session")
    
    # Validate state transition
    valid_states = ["opening_control", "opened", "closing_control", "closed"]
    if state not in valid_states:
        raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of: {valid_states}")
    
    session["state"] = state
    if state == "closed":
        session["stop_at"] = datetime.utcnow().isoformat()
    
    return APIResponseHelper.success(
        data=session,
        message=f"POS session state updated to {state}"
    )

@router.get("/sessions")
async def get_sessions(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Get POS sessions for the current user"""
    
    user_sessions = [
        session for session in pos_sessions.values()
        if session["user_id"] == current_user.id
    ]
    
    # Sort by start_at descending and limit
    user_sessions.sort(key=lambda x: x["start_at"], reverse=True)
    user_sessions = user_sessions[:limit]
    
    return APIResponseHelper.success(
        data=user_sessions,
        message=f"Retrieved {len(user_sessions)} POS sessions",
        meta={
            "total": len(user_sessions),
            "limit": limit
        }
    )