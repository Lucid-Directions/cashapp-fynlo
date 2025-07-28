"""
Offline Sync API endpoints for Fynlo POS
Handles batch upload, conflict resolution, and offline synchronization
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Body, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app.core.database import get_db, User
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.sync_manager import get_sync_manager, ConflictResolution

router = APIRouter()

# Sync Models
class SyncActionRequest(BaseModel):
    """Single sync action request"""
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str = Field(..., description="Type of entity (orders, products, customers, payments)")
    entity_id: str = Field(..., description="ID of the entity")
    action: str = Field(..., description="Action type (create, update, delete)")
    data: Dict[str, Any] = Field(..., description="Entity data")
    client_timestamp: str = Field(..., description="Client timestamp in ISO format")
    version: int = Field(default=1, description="Entity version for optimistic locking")

class BatchUploadRequest(BaseModel):
    """Batch upload request"""
    device_id: Optional[str] = Field(None, description="Device identifier")
    sync_actions: List[SyncActionRequest] = Field(..., description="List of sync actions")
    force_overwrite: bool = Field(default=False, description="Force overwrite on conflicts")

class DownloadChangesRequest(BaseModel):
    """Download changes request"""
    last_sync_timestamp: Optional[str] = Field(None, description="Last sync timestamp in ISO format")
    entity_types: Optional[List[str]] = Field(None, description="Entity types to sync")
    limit: int = Field(default=1000, le=5000, description="Maximum number of changes to return")

class ConflictResolutionRequest(BaseModel):
    """Conflict resolution request"""
    resolution_strategy: str = Field(..., description="Resolution strategy (server_wins, client_wins, merge, manual)")
    merged_data: Optional[Dict[str, Any]] = Field(None, description="Merged data for merge strategy")

@router.post("/upload-batch")
async def upload_batch_actions(
    request: BatchUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload batch of offline actions for synchronization
    Handles conflict detection and resolution
    """
    try:
        # Validate restaurant access
        restaurant_id = str(current_user.restaurant_id)
        if not restaurant_id:
            raise FynloException(
                message="User must be associated with a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Convert Pydantic models to dict for processing
        sync_actions = [action.dict() for action in request.sync_actions]
        
        # Get sync manager and process batch upload
        sync_manager = get_sync_manager(db)
        result = sync_manager.batch_upload(
            sync_actions=sync_actions,
            restaurant_id=restaurant_id,
            user_id=str(current_user.id),
            device_id=request.device_id
        )
        
        # Determine response message based on results
        if result["conflicts"] > 0:
            message = f"Batch upload completed with {result['conflicts']} conflicts requiring resolution"
            status_code = 206  # Partial Content
        elif result["failed"] > 0:
            message = f"Batch upload completed with {result['failed']} failures"
            status_code = 207  # Multi-Status
        else:
            message = f"Batch upload completed successfully - {result['successful']} actions processed"
            status_code = 200
        
        return APIResponseHelper.success(
            data=result,
            message=message,
            meta={
                "restaurant_id": restaurant_id,
                "device_id": request.device_id,
                "processing_summary": {
                    "total": result["total_actions"],
                    "successful": result["successful"],
                    "failed": result["failed"],
                    "conflicts": result["conflicts"]
                }
            },
            status_code=status_code
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to process batch upload: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/download-changes")
async def download_server_changes(
    last_sync_timestamp: Optional[str] = Query(None, description="Last sync timestamp"),
    entity_types: Optional[str] = Query(None, description="Comma-separated entity types"),
    limit: int = Query(1000, le=5000, description="Maximum changes to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download server changes since last sync timestamp
    Returns incremental changes for offline synchronization
    """
    try:
        # Validate restaurant access
        restaurant_id = str(current_user.restaurant_id)
        if not restaurant_id:
            raise FynloException(
                message="User must be associated with a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Parse parameters
        last_sync_dt = None
        if last_sync_timestamp:
            try:
                last_sync_dt = datetime.fromisoformat(last_sync_timestamp.replace("Z", "+00:00"))
            except ValueError:
                raise FynloException(
                    message="Invalid timestamp format",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
        
        entity_type_list = None
        if entity_types:
            entity_type_list = [t.strip() for t in entity_types.split(",")]
        
        # Get sync manager and download changes
        sync_manager = get_sync_manager(db)
        changes = sync_manager.download_changes(
            restaurant_id=restaurant_id,
            last_sync_timestamp=last_sync_dt,
            entity_types=entity_type_list
        )
        
        # Apply limit to total changes
        if changes["total_changes"] > limit:
            # Truncate changes to respect limit
            truncated_changes = {}
            remaining_limit = limit
            
            for entity_type, entity_changes in changes["changes"].items():
                if remaining_limit <= 0:
                    truncated_changes[entity_type] = []
                elif len(entity_changes) <= remaining_limit:
                    truncated_changes[entity_type] = entity_changes
                    remaining_limit -= len(entity_changes)
                else:
                    truncated_changes[entity_type] = entity_changes[:remaining_limit]
                    remaining_limit = 0
            
            changes["changes"] = truncated_changes
            changes["truncated"] = True
            changes["truncated_total"] = changes["total_changes"]
            changes["total_changes"] = limit
        
        return APIResponseHelper.success(
            data=changes,
            message=f"Downloaded {changes['total_changes']} changes since last sync",
            meta={
                "restaurant_id": restaurant_id,
                "sync_window": {
                    "from": last_sync_timestamp,
                    "to": changes["sync_timestamp"]
                },
                "entity_types_requested": entity_type_list,
                "limit_applied": limit,
                "has_more": changes.get("truncated", False)
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to download changes: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/resolve-conflict/{conflict_id}")
async def resolve_sync_conflict(
    conflict_id: str = Path(..., description="Conflict ID to resolve"),
    request: ConflictResolutionRequest = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resolve synchronization conflict with specified strategy
    """
    try:
        # Validate resolution strategy
        try:
            resolution_strategy = ConflictResolution(request.resolution_strategy)
        except ValueError:
            raise FynloException(
                message=f"Invalid resolution strategy: {request.resolution_strategy}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get sync manager and resolve conflict
        sync_manager = get_sync_manager(db)
        result = sync_manager.resolve_conflict(
            conflict_id=conflict_id,
            resolution_strategy=resolution_strategy,
            merged_data=request.merged_data
        )
        
        return APIResponseHelper.success(
            data=result,
            message=f"Conflict resolved using {resolution_strategy.value} strategy",
            meta={
                "conflict_id": conflict_id,
                "resolution_strategy": resolution_strategy.value
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to resolve conflict: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/status")
async def get_sync_status(
    device_id: Optional[str] = Query(None, description="Device ID for device-specific status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get synchronization status for restaurant or specific device
    """
    try:
        restaurant_id = str(current_user.restaurant_id)
        if not restaurant_id:
            raise FynloException(
                message="User must be associated with a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        sync_manager = get_sync_manager(db)
        status = sync_manager.get_sync_status(
            restaurant_id=restaurant_id,
            device_id=device_id
        )
        
        return APIResponseHelper.success(
            data=status,
            message="Sync status retrieved successfully",
            meta={
                "restaurant_id": restaurant_id,
                "device_id": device_id
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get sync status: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/conflicts")
async def get_active_conflicts(
    limit: int = Query(50, le=200, description="Maximum conflicts to return"),
    offset: int = Query(0, description="Offset for pagination"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of active synchronization conflicts requiring resolution
    """
    try:
        restaurant_id = str(current_user.restaurant_id)
        if not restaurant_id:
            raise FynloException(
                message="User must be associated with a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Get sync manager and retrieve conflicts
        sync_manager = get_sync_manager(db)
        
        # Filter conflicts by restaurant
        restaurant_conflicts = [
            c for c in sync_manager.conflicts 
            if c.sync_record.restaurant_id == restaurant_id
        ]
        
        # Apply pagination
        total_conflicts = len(restaurant_conflicts)
        paginated_conflicts = restaurant_conflicts[offset:offset + limit]
        
        conflicts_data = [conflict.to_dict() for conflict in paginated_conflicts]
        
        return APIResponseHelper.success(
            data=conflicts_data,
            message=f"Retrieved {len(conflicts_data)} active conflicts",
            meta={
                "restaurant_id": restaurant_id,
                "total_conflicts": total_conflicts,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_conflicts
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to get conflicts: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.delete("/conflicts/{conflict_id}")
async def dismiss_conflict(
    conflict_id: str = Path(..., description="Conflict ID to dismiss"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dismiss a synchronization conflict (manual resolution)
    """
    try:
        # Only managers and owners can dismiss conflicts
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        sync_manager = get_sync_manager(db)
        
        # Find and remove conflict
        conflict_found = False
        for i, conflict in enumerate(sync_manager.conflicts):
            if conflict.sync_record.id == conflict_id:
                sync_manager.conflicts.pop(i)
                conflict_found = True
                break
        
        if not conflict_found:
            raise FynloException(
                message="Conflict not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        return APIResponseHelper.success(
            message="Conflict dismissed successfully",
            meta={
                "conflict_id": conflict_id,
                "dismissed_by": current_user.username
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to dismiss conflict: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.post("/force-sync")
async def force_full_synchronization(
    entity_types: Optional[List[str]] = Body(None, description="Entity types to force sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force full synchronization for restaurant
    Use when normal sync is not sufficient
    """
    try:
        # Only managers and owners can force sync
        if current_user.role not in ["restaurant_owner", "platform_owner", "manager"]:
            raise FynloException(
                message="Access denied - management permissions required",
                error_code=ErrorCodes.FORBIDDEN,
                status_code=403
            )
        
        restaurant_id = str(current_user.restaurant_id)
        
        # Get full changes without timestamp filtering
        sync_manager = get_sync_manager(db)
        changes = sync_manager.download_changes(
            restaurant_id=restaurant_id,
            last_sync_timestamp=None,  # No timestamp = full sync
            entity_types=entity_types
        )
        
        return APIResponseHelper.success(
            data=changes,
            message="Full synchronization data prepared",
            meta={
                "restaurant_id": restaurant_id,
                "sync_type": "full",
                "entity_types": entity_types,
                "forced_by": current_user.username
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to force synchronization: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )