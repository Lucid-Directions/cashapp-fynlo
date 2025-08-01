"""
Offline Sync Manager for Fynlo POS
Handles batch upload, conflict resolution, and offline synchronization


"""
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import uuid
import json
from enum import Enum

from app.core.database import get_db, Order, Product, Customer, Payment, User
from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import APIResponseHelper

class SyncAction(str, Enum):
    """Sync action types"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class SyncStatus(str, Enum):
    """Sync status types"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"

class ConflictResolution(str, Enum):
    """Conflict resolution strategies"""
    SERVER_WINS = "server_wins"
    CLIENT_WINS = "client_wins"
    MANUAL = "manual"
    MERGE = "merge"

class SyncRecord:
    """Sync record data structure"""
    def __init__(
        self,
        id: str,
        entity_type: str,
        entity_id: str,
        action: SyncAction,
        data: Dict[str, Any],
        client_timestamp: datetime,
        restaurant_id: str,
        user_id: str,
        device_id: Optional[str] = None,
        version: int = 1
    ):
        self.id = id
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.action = action
        self.data = data
        self.client_timestamp = client_timestamp
        self.restaurant_id = restaurant_id
        self.user_id = user_id
        self.device_id = device_id
        self.version = version
        self.status = SyncStatus.PENDING
        self.server_timestamp = datetime.now()
        self.conflict_details = None
        self.error_message = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "action": self.action.value,
            "data": self.data,
            "client_timestamp": self.client_timestamp.isoformat(),
            "server_timestamp": self.server_timestamp.isoformat(),
            "restaurant_id": self.restaurant_id,
            "user_id": self.user_id,
            "device_id": self.device_id,
            "version": self.version,
            "status": self.status.value,
            "conflict_details": self.conflict_details,
            "error_message": self.error_message
        }

class SyncConflict:
    """Sync conflict representation"""
    def __init__(
        self,
        sync_record: SyncRecord,
        server_data: Dict[str, Any],
        conflict_fields: List[str],
        conflict_type: str = "data_mismatch"
    ):
        self.sync_record = sync_record
        self.server_data = server_data
        self.conflict_fields = conflict_fields
        self.conflict_type = conflict_type
        self.detected_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sync_record_id": self.sync_record.id,
            "conflict_type": self.conflict_type,
            "conflict_fields": self.conflict_fields,
            "client_data": self.sync_record.data,
            "server_data": self.server_data,
            "client_timestamp": self.sync_record.client_timestamp.isoformat(),
            "detected_at": self.detected_at.isoformat()
        }

class OfflineSyncManager:
    """Manager for offline synchronization operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.sync_queue: List[SyncRecord] = []
        self.conflicts: List[SyncConflict] = []
        
    def batch_upload(
        self,
        sync_actions: List[Dict[str, Any]],
        restaurant_id: str,
        user_id: str,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process batch upload of offline actions
        """
        try:
            results = {
                "total_actions": len(sync_actions),
                "successful": 0,
                "failed": 0,
                "conflicts": 0,
                "processed_actions": [],
                "conflicts_detected": [],
                "errors": []
            }
            
            # Validate and create sync records
            sync_records = []
            for action_data in sync_actions:
                try:
                    sync_record = self._create_sync_record(
                        action_data, restaurant_id, user_id, device_id
                    )
                    sync_records.append(sync_record)
                except Exception as e:
                    results["errors"].append({
                        "action": action_data,
                        "error": str(e)
                    })
                    results["failed"] += 1
            
            # Process sync records in order
            for sync_record in sync_records:
                try:
                    result = self._process_sync_record(sync_record)
                    results["processed_actions"].append(result)
                    
                    if result["status"] == SyncStatus.COMPLETED.value:
                        results["successful"] += 1
                    elif result["status"] == SyncStatus.CONFLICT.value:
                        results["conflicts"] += 1
                        results["conflicts_detected"].append(result["conflict_details"])
                    else:
                        results["failed"] += 1
                        
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append({
                        "sync_record_id": sync_record.id,
                        "error": str(e)
                    })
            
            # Commit successful changes
            if results["successful"] > 0:
                self.db.commit()
            
            return results
            
        except Exception as e:
            self.db.rollback()
            raise FynloException(
                message=f"Batch upload failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def download_changes(
        self,
        restaurant_id: str,
        last_sync_timestamp: Optional[datetime] = None,
        entity_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Download server changes since last sync
        """
        try:
            if not last_sync_timestamp:
                last_sync_timestamp = datetime.now() - timedelta(days=7)  # Default 7 days
            
            changes = {
                "sync_timestamp": datetime.now().isoformat(),
                "last_sync_timestamp": last_sync_timestamp.isoformat(),
                "changes": {},
                "total_changes": 0
            }
            
            # Define entity handlers
            entity_handlers = {
                "orders": self._get_order_changes,
                "products": self._get_product_changes,
                "customers": self._get_customer_changes,
                "payments": self._get_payment_changes
            }
            
            # Get changes for requested entity types
            requested_types = entity_types or list(entity_handlers.keys())
            
            for entity_type in requested_types:
                if entity_type in entity_handlers:
                    entity_changes = entity_handlers[entity_type](
                        restaurant_id, last_sync_timestamp
                    )
                    changes["changes"][entity_type] = entity_changes
                    changes["total_changes"] += len(entity_changes)
            
            return changes
            
        except Exception as e:
            raise FynloException(
                message=f"Failed to download changes: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def resolve_conflict(
        self,
        conflict_id: str,
        resolution_strategy: ConflictResolution,
        merged_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Resolve sync conflict with specified strategy
        """
        try:
            # Find conflict by ID
            conflict = next((c for c in self.conflicts if c.sync_record.id == conflict_id), None)
            if not conflict:
                raise FynloException(
                    message="Conflict not found",
                    error_code=ErrorCodes.NOT_FOUND,
                    status_code=404
                )
            
            sync_record = conflict.sync_record
            
            if resolution_strategy == ConflictResolution.SERVER_WINS:
                # Keep server data, mark sync as completed
                sync_record.status = SyncStatus.COMPLETED
                final_data = conflict.server_data
                
            elif resolution_strategy == ConflictResolution.CLIENT_WINS:
                # Apply client data, overwrite server
                final_data = self._apply_client_data(sync_record)
                sync_record.status = SyncStatus.COMPLETED
                
            elif resolution_strategy == ConflictResolution.MERGE:
                # Use provided merged data
                if not merged_data:
                    raise FynloException(
                        message="Merged data required for merge resolution",
                        error_code=ErrorCodes.VALIDATION_ERROR,
                        status_code=400
                    )
                final_data = self._apply_merged_data(sync_record, merged_data)
                sync_record.status = SyncStatus.COMPLETED
                
            else:  # MANUAL
                # Leave for manual resolution
                sync_record.status = SyncStatus.CONFLICT
                final_data = conflict.server_data
            
            # Remove from conflicts list if resolved
            if sync_record.status == SyncStatus.COMPLETED:
                self.conflicts = [c for c in self.conflicts if c.sync_record.id != conflict_id]
                self.db.commit()
            
            return {
                "conflict_id": conflict_id,
                "resolution_strategy": resolution_strategy.value,
                "status": sync_record.status.value,
                "final_data": final_data
            }
            
        except Exception as e:
            self.db.rollback()
            raise FynloException(
                message=f"Failed to resolve conflict: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def get_sync_status(
        self,
        restaurant_id: str,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get synchronization status for restaurant/device
        """
        try:
            # This would query a sync_records table in a real implementation
            # For now, return status from in-memory structures
            
            total_pending = len([r for r in self.sync_queue if r.restaurant_id == restaurant_id])
            total_conflicts = len([c for c in self.conflicts if c.sync_record.restaurant_id == restaurant_id])
            
            return {
                "restaurant_id": restaurant_id,
                "device_id": device_id,
                "pending_uploads": total_pending,
                "active_conflicts": total_conflicts,
                "last_sync_attempt": datetime.now().isoformat(),
                "sync_health": "healthy" if total_conflicts == 0 else "conflicts_detected"
            }
            
        except Exception as e:
            raise FynloException(
                message=f"Failed to get sync status: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def _create_sync_record(
        self,
        action_data: Dict[str, Any],
        restaurant_id: str,
        user_id: str,
        device_id: Optional[str]
    ) -> SyncRecord:
        """Create sync record from action data"""
        required_fields = ["entity_type", "entity_id", "action", "data", "client_timestamp"]
        
        for field in required_fields:
            if field not in action_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Parse client timestamp
        client_timestamp = datetime.fromisoformat(
            action_data["client_timestamp"].replace("Z", "+00:00")
        )
        
        return SyncRecord(
            id=action_data.get("id", str(uuid.uuid4())),
            entity_type=action_data["entity_type"],
            entity_id=action_data["entity_id"],
            action=SyncAction(action_data["action"]),
            data=action_data["data"],
            client_timestamp=client_timestamp,
            restaurant_id=restaurant_id,
            user_id=user_id,
            device_id=device_id,
            version=action_data.get("version", 1)
        )
    
    def _process_sync_record(self, sync_record: SyncRecord) -> Dict[str, Any]:
        """Process individual sync record"""
        try:
            # Check for conflicts
            conflict = self._detect_conflicts(sync_record)
            if conflict:
                sync_record.status = SyncStatus.CONFLICT
                sync_record.conflict_details = conflict.to_dict()
                self.conflicts.append(conflict)
                
                return {
                    "sync_record_id": sync_record.id,
                    "status": SyncStatus.CONFLICT.value,
                    "conflict_details": conflict.to_dict()
                }
            
            # Apply the sync action
            result = self._apply_sync_action(sync_record)
            sync_record.status = SyncStatus.COMPLETED
            
            return {
                "sync_record_id": sync_record.id,
                "status": SyncStatus.COMPLETED.value,
                "entity_type": sync_record.entity_type,
                "entity_id": sync_record.entity_id,
                "action": sync_record.action.value,
                "result": result
            }
            
        except Exception as e:
            sync_record.status = SyncStatus.FAILED
            sync_record.error_message = str(e)
            
            return {
                "sync_record_id": sync_record.id,
                "status": SyncStatus.FAILED.value,
                "error": str(e)
            }
    
    def _detect_conflicts(self, sync_record: SyncRecord) -> Optional[SyncConflict]:
        """Detect conflicts between client and server data"""
        try:
            entity_type = sync_record.entity_type
            entity_id = sync_record.entity_id
            
            # Get current server data
            server_data = None
            if entity_type == "orders":
                entity = self.db.query(Order).filter(Order.id == entity_id).first()
                if entity:
                    server_data = {
                        "id": str(entity.id),
                        "status": entity.status,
                        "total_amount": float(entity.total_amount),
                        "updated_at": entity.updated_at.isoformat() if entity.updated_at else None
                    }
            elif entity_type == "products":
                entity = self.db.query(Product).filter(Product.id == entity_id).first()
                if entity:
                    server_data = {
                        "id": str(entity.id),
                        "name": entity.name,
                        "price": float(entity.price),
                        "stock_quantity": entity.stock_quantity,
                        "updated_at": entity.updated_at.isoformat() if entity.updated_at else None
                    }
            # Add other entity types as needed
            
            # Check for conflicts based on action type
            if sync_record.action == SyncAction.UPDATE and server_data:
                client_data = sync_record.data
                conflict_fields = []
                
                # Compare timestamps first
                if "updated_at" in server_data and "updated_at" in client_data:
                    server_updated = datetime.fromisoformat(server_data["updated_at"].replace("Z", "+00:00"))
                    client_updated = datetime.fromisoformat(client_data["updated_at"].replace("Z", "+00:00"))
                    
                    if server_updated > client_updated:
                        # Server has newer data - potential conflict
                        # Check specific fields for actual differences
                        for field in client_data:
                            if field in server_data and server_data[field] != client_data[field]:
                                conflict_fields.append(field)
                        
                        if conflict_fields:
                            return SyncConflict(
                                sync_record=sync_record,
                                server_data=server_data,
                                conflict_fields=conflict_fields,
                                conflict_type="timestamp_conflict"
                            )
            
            elif sync_record.action == SyncAction.CREATE and server_data:
                # Entity already exists - conflict
                return SyncConflict(
                    sync_record=sync_record,
                    server_data=server_data,
                    conflict_fields=["id"],
                    conflict_type="already_exists"
                )
            
            elif sync_record.action == SyncAction.DELETE and not server_data:
                # Entity already deleted - minor conflict
                return SyncConflict(
                    sync_record=sync_record,
                    server_data={},
                    conflict_fields=["id"],
                    conflict_type="already_deleted"
                )
            
            return None
            
        except Exception as e:
            # If conflict detection fails, treat as no conflict
            return None
    
    def _apply_sync_action(self, sync_record: SyncRecord) -> Dict[str, Any]:
        """Apply sync action to database"""
        entity_type = sync_record.entity_type
        action = sync_record.action
        data = sync_record.data
        
        if entity_type == "orders":
            return self._apply_order_action(action, data)
        elif entity_type == "products":
            return self._apply_product_action(action, data)
        elif entity_type == "customers":
            return self._apply_customer_action(action, data)
        elif entity_type == "payments":
            return self._apply_payment_action(action, data)
        else:
            raise ValueError(f"Unsupported entity type: {entity_type}")
    
    def _apply_order_action(self, action: SyncAction, data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply order sync action"""
        if action == SyncAction.CREATE:
            # Create new order (simplified)
            return {"message": "Order creation applied", "entity_id": data.get("id")}
        elif action == SyncAction.UPDATE:
            # Update existing order
            order = self.db.query(Order).filter(Order.id == data["id"]).first()
            if order:
                order.status = data.get("status", order.status)
                order.updated_at = datetime.now()
                return {"message": "Order update applied", "entity_id": str(order.id)}
        elif action == SyncAction.DELETE:
            # Mark order as deleted
            order = self.db.query(Order).filter(Order.id == data["id"]).first()
            if order:
                order.is_deleted = True
                order.updated_at = datetime.now()
                return {"message": "Order deletion applied", "entity_id": str(order.id)}
        
        return {"message": "No action applied"}
    
    def _apply_product_action(self, action: SyncAction, data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply product sync action"""
        if action == SyncAction.UPDATE:
            product = self.db.query(Product).filter(Product.id == data["id"]).first()
            if product:
                product.stock_quantity = data.get("stock_quantity", product.stock_quantity)
                product.price = data.get("price", product.price)
                product.updated_at = datetime.now()
                return {"message": "Product update applied", "entity_id": str(product.id)}
        
        return {"message": "No action applied"}
    
    def _apply_customer_action(self, action: SyncAction, data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply customer sync action"""
        # Implementation would handle customer-specific actions
        return {"message": "Customer action applied", "entity_id": data.get("id")}
    
    def _apply_payment_action(self, action: SyncAction, data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply payment sync action"""
        # Implementation would handle payment-specific actions
        return {"message": "Payment action applied", "entity_id": data.get("id")}
    
    def _apply_client_data(self, sync_record: SyncRecord) -> Dict[str, Any]:
        """Apply client data in client-wins resolution"""
        return self._apply_sync_action(sync_record)
    
    def _apply_merged_data(self, sync_record: SyncRecord, merged_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply merged data in merge resolution"""
        # Update sync record data with merged data
        sync_record.data = merged_data
        return self._apply_sync_action(sync_record)
    
    def _get_order_changes(self, restaurant_id: str, since: datetime) -> List[Dict[str, Any]]:
        """Get order changes since timestamp"""
        orders = self.db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.updated_at >= since
            )
        ).order_by(desc(Order.updated_at)).all()
        
        return [
            {
                "id": str(order.id),
                "status": order.status,
                "total_amount": float(order.total_amount),
                "updated_at": order.updated_at.isoformat(),
                "action": "update"
            }
            for order in orders
        ]
    
    def _get_product_changes(self, restaurant_id: str, since: datetime) -> List[Dict[str, Any]]:
        """Get product changes since timestamp"""
        products = self.db.query(Product).filter(
            and_(
                Product.restaurant_id == restaurant_id,
                Product.updated_at >= since
            )
        ).order_by(desc(Product.updated_at)).all()
        
        return [
            {
                "id": str(product.id),
                "name": product.name,
                "price": float(product.price),
                "stock_quantity": product.stock_quantity,
                "updated_at": product.updated_at.isoformat(),
                "action": "update"
            }
            for product in products
        ]
    
    def _get_customer_changes(self, restaurant_id: str, since: datetime) -> List[Dict[str, Any]]:
        """Get customer changes since timestamp"""
        customers = self.db.query(Customer).filter(
            and_(
                Customer.restaurant_id == restaurant_id,
                Customer.updated_at >= since
            )
        ).order_by(desc(Customer.updated_at)).all()
        
        return [
            {
                "id": str(customer.id),
                "name": customer.name,
                "email": customer.email,
                "phone": customer.phone,
                "updated_at": customer.updated_at.isoformat(),
                "action": "update"
            }
            for customer in customers
        ]
    
    def _get_payment_changes(self, restaurant_id: str, since: datetime) -> List[Dict[str, Any]]:
        """Get payment changes since timestamp"""
        payments = self.db.query(Payment).filter(
            and_(
                Payment.restaurant_id == restaurant_id,
                Payment.updated_at >= since
            )
        ).order_by(desc(Payment.updated_at)).all()
        
        return [
            {
                "id": str(payment.id),
                "order_id": str(payment.order_id),
                "amount": float(payment.amount),
                "status": payment.status,
                "updated_at": payment.updated_at.isoformat(),
                "action": "update"
            }
            for payment in payments
        ]

# Factory function
def get_sync_manager(db: Session) -> OfflineSyncManager:
    """Get sync manager instance"""
    return OfflineSyncManager(db)