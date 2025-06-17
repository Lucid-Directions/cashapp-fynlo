import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from collections import defaultdict
from decimal import Decimal

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from odoo.tools import float_compare

_logger = logging.getLogger(__name__)


class DataSyncService(models.Model):
    """Comprehensive Data Synchronization Service for Phase 3"""
    _name = 'pos.data.sync.service'
    _description = 'Data Synchronization Service'
    
    # Configuration
    name = fields.Char('Service Name', default='Data Sync Service')
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    
    # Sync settings
    sync_enabled = fields.Boolean('Sync Enabled', default=True)
    offline_mode = fields.Boolean('Offline Mode', default=False)
    max_batch_size = fields.Integer('Max Batch Size', default=100)
    sync_timeout = fields.Integer('Sync Timeout (seconds)', default=30)
    conflict_resolution = fields.Selection([
        ('server_wins', 'Server Wins'),
        ('client_wins', 'Client Wins'),
        ('merge', 'Smart Merge'),
        ('manual', 'Manual Resolution')
    ], string='Conflict Resolution', default='merge')
    
    # Status tracking
    last_sync = fields.Datetime('Last Sync')
    sync_status = fields.Selection([
        ('idle', 'Idle'),
        ('syncing', 'Syncing'),
        ('error', 'Error'),
        ('conflict', 'Conflict')
    ], string='Sync Status', default='idle')
    
    # Statistics
    total_syncs = fields.Integer('Total Syncs', default=0)
    successful_syncs = fields.Integer('Successful Syncs', default=0)
    failed_syncs = fields.Integer('Failed Syncs', default=0)
    conflicts_resolved = fields.Integer('Conflicts Resolved', default=0)
    
    # Status
    active = fields.Boolean('Active', default=True)
    
    @api.model
    def get_syncable_models(self):
        """Get list of models that support synchronization"""
        return [
            'pos.order',
            'pos.order.line',
            'pos.payment',
            'pos.session',
            'product.product',
            'pos.category',
            'res.partner',
            'account.tax',
            'pos.config',
            'res.users'
        ]
    
    @api.model
    def create_sync_record(self, model_name: str, record_id: int, action: str, data: Dict[str, Any] = None) -> int:
        """Create sync tracking record for a data change"""
        try:
            # Calculate data hash for conflict detection
            data_hash = self._calculate_data_hash(data or {})
            
            sync_record = self.env['pos.sync.log'].create({
                'entity_type': model_name,
                'entity_id': record_id,
                'action': action,
                'data_hash': data_hash,
                'data_payload': json.dumps(data or {}, default=str),
                'created_at': fields.Datetime.now(),
                'sync_status': 'pending'
            })
            
            # Trigger real-time sync notification
            self._notify_sync_change(model_name, record_id, action)
            
            return sync_record.id
            
        except Exception as e:
            _logger.error(f"Failed to create sync record: {e}")
            return None
    
    def process_offline_queue(self, session_id: int = None) -> Dict[str, Any]:
        """Process offline queue for synchronization"""
        try:
            self.write({'sync_status': 'syncing'})
            
            # Get pending sync records
            domain = [('sync_status', '=', 'pending')]
            if session_id:
                domain.append(('session_id', '=', session_id))
            
            pending_syncs = self.env['pos.sync.log'].search(
                domain, 
                order='created_at asc',
                limit=self.max_batch_size
            )
            
            if not pending_syncs:
                self.write({'sync_status': 'idle'})
                return {
                    'success': True,
                    'message': 'No pending syncs to process',
                    'processed': 0
                }
            
            # Group by entity type for batch processing
            grouped_syncs = self._group_syncs_by_entity(pending_syncs)
            
            # Process each group
            results = {
                'success': True,
                'processed': 0,
                'conflicts': 0,
                'errors': 0,
                'details': []
            }
            
            for entity_type, syncs in grouped_syncs.items():
                batch_result = self._process_entity_batch(entity_type, syncs)
                results['processed'] += batch_result['processed']
                results['conflicts'] += batch_result['conflicts']
                results['errors'] += batch_result['errors']
                results['details'].append(batch_result)
                
                if not batch_result['success']:
                    results['success'] = False
            
            # Update statistics
            self._update_sync_statistics(results)
            
            # Update sync status
            if results['conflicts'] > 0:
                self.write({'sync_status': 'conflict'})
            elif results['errors'] > 0:
                self.write({'sync_status': 'error'})
            else:
                self.write({
                    'sync_status': 'idle',
                    'last_sync': fields.Datetime.now()
                })
            
            return results
            
        except Exception as e:
            _logger.error(f"Offline queue processing failed: {e}")
            self.write({'sync_status': 'error'})
            return {
                'success': False,
                'error': str(e),
                'error_type': 'queue_processing_error'
            }
    
    def _group_syncs_by_entity(self, syncs) -> Dict[str, List]:
        """Group sync records by entity type"""
        grouped = defaultdict(list)
        for sync in syncs:
            grouped[sync.entity_type].append(sync)
        return dict(grouped)
    
    def _process_entity_batch(self, entity_type: str, syncs: List) -> Dict[str, Any]:
        """Process a batch of syncs for a specific entity type"""
        try:
            model = self.env[entity_type]
            
            results = {
                'success': True,
                'entity_type': entity_type,
                'processed': 0,
                'conflicts': 0,
                'errors': 0,
                'operations': []
            }
            
            for sync in syncs:
                try:
                    operation_result = self._process_single_sync(model, sync)
                    results['operations'].append(operation_result)
                    
                    if operation_result['success']:
                        results['processed'] += 1
                        sync.write({
                            'sync_status': 'completed',
                            'synced_at': fields.Datetime.now()
                        })
                    elif operation_result.get('conflict'):
                        results['conflicts'] += 1
                        sync.write({'sync_status': 'conflict'})
                    else:
                        results['errors'] += 1
                        sync.write({
                            'sync_status': 'error',
                            'error_message': operation_result.get('error', 'Unknown error')
                        })
                        
                except Exception as e:
                    _logger.error(f"Failed to process sync {sync.id}: {e}")
                    results['errors'] += 1
                    sync.write({
                        'sync_status': 'error',
                        'error_message': str(e)
                    })
            
            return results
            
        except Exception as e:
            _logger.error(f"Entity batch processing failed for {entity_type}: {e}")
            return {
                'success': False,
                'entity_type': entity_type,
                'error': str(e),
                'processed': 0,
                'conflicts': 0,
                'errors': len(syncs)
            }
    
    def _process_single_sync(self, model, sync) -> Dict[str, Any]:
        """Process a single sync operation"""
        try:
            action = sync.action
            entity_id = sync.entity_id
            data_payload = json.loads(sync.data_payload) if sync.data_payload else {}
            
            if action == 'create':
                return self._process_create_sync(model, data_payload, sync)
            elif action == 'update':
                return self._process_update_sync(model, entity_id, data_payload, sync)
            elif action == 'delete':
                return self._process_delete_sync(model, entity_id, sync)
            else:
                return {
                    'success': False,
                    'error': f'Unknown action: {action}',
                    'sync_id': sync.id
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'sync_id': sync.id
            }
    
    def _process_create_sync(self, model, data: Dict[str, Any], sync) -> Dict[str, Any]:
        """Process create synchronization"""
        try:
            # Check if record already exists (duplicate detection)
            existing_record = self._find_existing_record(model, data, sync)
            
            if existing_record:
                # Handle duplicate - update instead of create
                return self._process_update_sync(model, existing_record.id, data, sync)
            
            # Create new record
            new_record = model.create(data)
            
            return {
                'success': True,
                'action': 'create',
                'record_id': new_record.id,
                'sync_id': sync.id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'action': 'create',
                'sync_id': sync.id
            }
    
    def _process_update_sync(self, model, entity_id: int, data: Dict[str, Any], sync) -> Dict[str, Any]:
        """Process update synchronization with conflict detection"""
        try:
            record = model.browse(entity_id)
            
            if not record.exists():
                # Record doesn't exist - convert to create
                return self._process_create_sync(model, data, sync)
            
            # Check for conflicts
            conflict_result = self._detect_conflicts(record, data, sync)
            
            if conflict_result['has_conflict']:
                return self._resolve_conflict(record, data, sync, conflict_result)
            
            # No conflict - apply update
            record.write(data)
            
            return {
                'success': True,
                'action': 'update',
                'record_id': entity_id,
                'sync_id': sync.id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'action': 'update',
                'sync_id': sync.id
            }
    
    def _process_delete_sync(self, model, entity_id: int, sync) -> Dict[str, Any]:
        """Process delete synchronization"""
        try:
            record = model.browse(entity_id)
            
            if not record.exists():
                # Already deleted - consider success
                return {
                    'success': True,
                    'action': 'delete',
                    'record_id': entity_id,
                    'sync_id': sync.id,
                    'note': 'Already deleted'
                }
            
            # Check if record can be safely deleted
            if self._can_delete_record(record):
                record.unlink()
                return {
                    'success': True,
                    'action': 'delete',
                    'record_id': entity_id,
                    'sync_id': sync.id
                }
            else:
                # Mark as inactive instead of deleting
                if hasattr(record, 'active'):
                    record.write({'active': False})
                    return {
                        'success': True,
                        'action': 'deactivate',
                        'record_id': entity_id,
                        'sync_id': sync.id,
                        'note': 'Deactivated instead of deleted'
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Cannot delete record with dependencies',
                        'action': 'delete',
                        'sync_id': sync.id
                    }
                    
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'action': 'delete',
                'sync_id': sync.id
            }
    
    def _detect_conflicts(self, record, incoming_data: Dict[str, Any], sync) -> Dict[str, Any]:
        """Detect conflicts between server and client data"""
        try:
            conflicts = []
            
            # Get current server data hash
            current_data = self._extract_record_data(record)
            current_hash = self._calculate_data_hash(current_data)
            
            # Compare with sync data hash
            if sync.data_hash != current_hash:
                # Check field-level conflicts
                for field_name, new_value in incoming_data.items():
                    if field_name in current_data:
                        current_value = current_data[field_name]
                        if not self._values_equal(current_value, new_value, record._fields.get(field_name)):
                            conflicts.append({
                                'field': field_name,
                                'server_value': current_value,
                                'client_value': new_value,
                                'conflict_type': 'value_mismatch'
                            })
            
            return {
                'has_conflict': len(conflicts) > 0,
                'conflicts': conflicts,
                'server_hash': current_hash,
                'client_hash': sync.data_hash
            }
            
        except Exception as e:
            _logger.error(f"Conflict detection failed: {e}")
            return {
                'has_conflict': False,
                'conflicts': [],
                'error': str(e)
            }
    
    def _resolve_conflict(self, record, incoming_data: Dict[str, Any], sync, conflict_result: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflicts based on resolution strategy"""
        try:
            strategy = self.conflict_resolution
            conflicts = conflict_result['conflicts']
            
            if strategy == 'server_wins':
                # Server data takes precedence - no update needed
                return {
                    'success': True,
                    'action': 'conflict_resolved',
                    'resolution': 'server_wins',
                    'conflicts_count': len(conflicts),
                    'sync_id': sync.id
                }
                
            elif strategy == 'client_wins':
                # Client data takes precedence - apply all changes
                record.write(incoming_data)
                return {
                    'success': True,
                    'action': 'conflict_resolved',
                    'resolution': 'client_wins',
                    'conflicts_count': len(conflicts),
                    'sync_id': sync.id
                }
                
            elif strategy == 'merge':
                # Smart merge - apply non-conflicting changes
                merged_data = self._smart_merge(record, incoming_data, conflicts)
                if merged_data:
                    record.write(merged_data)
                
                return {
                    'success': True,
                    'action': 'conflict_resolved',
                    'resolution': 'smart_merge',
                    'conflicts_count': len(conflicts),
                    'merged_fields': list(merged_data.keys()) if merged_data else [],
                    'sync_id': sync.id
                }
                
            else:  # manual
                # Create conflict record for manual resolution
                conflict_record = self._create_conflict_record(record, incoming_data, sync, conflicts)
                return {
                    'success': False,
                    'conflict': True,
                    'action': 'manual_resolution_required',
                    'conflict_record_id': conflict_record.id,
                    'conflicts_count': len(conflicts),
                    'sync_id': sync.id
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'action': 'conflict_resolution_failed',
                'sync_id': sync.id
            }
    
    def _smart_merge(self, record, incoming_data: Dict[str, Any], conflicts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform smart merge of conflicting data"""
        merged_data = {}
        conflict_fields = {c['field'] for c in conflicts}
        
        # Apply non-conflicting fields
        for field_name, value in incoming_data.items():
            if field_name not in conflict_fields:
                merged_data[field_name] = value
        
        # Smart resolution for conflicting fields
        for conflict in conflicts:
            field_name = conflict['field']
            server_value = conflict['server_value']
            client_value = conflict['client_value']
            
            # Apply field-specific merge logic
            merged_value = self._merge_field_values(
                record, field_name, server_value, client_value
            )
            
            if merged_value is not None:
                merged_data[field_name] = merged_value
        
        return merged_data
    
    def _merge_field_values(self, record, field_name: str, server_value: Any, client_value: Any) -> Any:
        """Merge specific field values using business logic"""
        field = record._fields.get(field_name)
        
        if not field:
            return client_value
        
        # Numeric fields - use latest timestamp logic or sum for quantities
        if field.type in ('integer', 'float', 'monetary'):
            if field_name in ('qty', 'quantity', 'amount_total', 'amount_paid'):
                # For quantities and amounts, use client value (latest transaction)
                return client_value
            else:
                # For other numeric fields, use server value (more authoritative)
                return server_value
        
        # Text fields - concatenate if both have values
        elif field.type in ('char', 'text'):
            if server_value and client_value and server_value != client_value:
                return f"{server_value} | {client_value}"
            return client_value or server_value
        
        # Boolean fields - use client value (user preference)
        elif field.type == 'boolean':
            return client_value
        
        # Date/datetime fields - use latest
        elif field.type in ('date', 'datetime'):
            if isinstance(client_value, str):
                try:
                    client_dt = fields.Datetime.from_string(client_value)
                    server_dt = fields.Datetime.from_string(server_value) if server_value else None
                    return client_value if not server_dt or client_dt > server_dt else server_value
                except:
                    return client_value
            return client_value
        
        # Selection fields - use client value
        elif field.type == 'selection':
            return client_value
        
        # Many2one fields - use client value
        elif field.type == 'many2one':
            return client_value
        
        # Default - use client value
        return client_value
    
    def _create_conflict_record(self, record, incoming_data: Dict[str, Any], sync, conflicts: List[Dict[str, Any]]):
        """Create conflict record for manual resolution"""
        return self.env['pos.sync.conflict'].create({
            'sync_log_id': sync.id,
            'entity_type': sync.entity_type,
            'entity_id': sync.entity_id,
            'server_data': json.dumps(self._extract_record_data(record), default=str),
            'client_data': json.dumps(incoming_data, default=str),
            'conflicts': json.dumps(conflicts, default=str),
            'status': 'pending',
            'created_at': fields.Datetime.now()
        })
    
    def _find_existing_record(self, model, data: Dict[str, Any], sync):
        """Find existing record for duplicate detection"""
        # Try to find by unique identifiers
        if 'id' in data and data['id']:
            return model.browse(data['id'])
        
        # Try common unique fields
        unique_fields = ['name', 'barcode', 'ref', 'email', 'login']
        
        for field in unique_fields:
            if field in data and data[field] and hasattr(model, field):
                existing = model.search([(field, '=', data[field])], limit=1)
                if existing:
                    return existing
        
        return None
    
    def _can_delete_record(self, record) -> bool:
        """Check if record can be safely deleted"""
        try:
            # Check for foreign key dependencies
            dependencies = []
            
            for model_name in self.env:
                model = self.env[model_name]
                for field_name, field in model._fields.items():
                    if (field.type == 'many2one' and 
                        field.comodel_name == record._name and
                        not field.ondelete == 'cascade'):
                        
                        dependent_records = model.search([
                            (field_name, '=', record.id)
                        ], limit=1)
                        
                        if dependent_records:
                            dependencies.append(f"{model_name}.{field_name}")
            
            return len(dependencies) == 0
            
        except Exception as e:
            _logger.error(f"Delete check failed: {e}")
            return False
    
    def _extract_record_data(self, record) -> Dict[str, Any]:
        """Extract relevant data from record for sync"""
        # Get fields that should be synced
        sync_fields = []
        for field_name, field in record._fields.items():
            if (not field.compute and 
                field.store and 
                field_name not in ('id', 'create_date', 'create_uid', 'write_date', 'write_uid')):
                sync_fields.append(field_name)
        
        data = record.read(sync_fields)[0] if sync_fields else {}
        
        # Remove the 'id' field that read() adds
        data.pop('id', None)
        
        return data
    
    def _calculate_data_hash(self, data: Dict[str, Any]) -> str:
        """Calculate hash for data integrity checking"""
        try:
            # Sort keys for consistent hashing
            sorted_data = json.dumps(data, sort_keys=True, default=str)
            return hashlib.md5(sorted_data.encode()).hexdigest()
        except Exception as e:
            _logger.error(f"Hash calculation failed: {e}")
            return ""
    
    def _values_equal(self, value1: Any, value2: Any, field) -> bool:
        """Compare two values considering field type"""
        if value1 is None and value2 is None:
            return True
        
        if value1 is None or value2 is None:
            return False
        
        if not field:
            return value1 == value2
        
        # Float comparison with precision
        if field.type == 'float':
            return float_compare(float(value1), float(value2), precision_digits=2) == 0
        
        # Monetary comparison
        elif field.type == 'monetary':
            return float_compare(float(value1), float(value2), precision_digits=2) == 0
        
        # Date/datetime comparison
        elif field.type in ('date', 'datetime'):
            if isinstance(value1, str):
                value1 = fields.Datetime.from_string(value1)
            if isinstance(value2, str):
                value2 = fields.Datetime.from_string(value2)
            return value1 == value2
        
        # Many2one comparison (compare IDs)
        elif field.type == 'many2one':
            id1 = value1.id if hasattr(value1, 'id') else value1
            id2 = value2.id if hasattr(value2, 'id') else value2
            return id1 == id2
        
        # Default comparison
        return value1 == value2
    
    def _notify_sync_change(self, model_name: str, record_id: int, action: str):
        """Send WebSocket notification for sync changes"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('sync.change', {
                'entity_type': model_name,
                'entity_id': record_id,
                'action': action,
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Failed to send sync notification: {e}")
    
    def _update_sync_statistics(self, results: Dict[str, Any]):
        """Update sync statistics"""
        try:
            self.total_syncs += results['processed']
            
            if results['success'] and results['errors'] == 0:
                self.successful_syncs += results['processed']
            else:
                self.failed_syncs += results['errors']
            
            self.conflicts_resolved += results['conflicts']
            
        except Exception as e:
            _logger.error(f"Failed to update sync statistics: {e}")
    
    def get_sync_status(self) -> Dict[str, Any]:
        """Get comprehensive sync status"""
        try:
            pending_syncs = self.env['pos.sync.log'].search_count([
                ('sync_status', '=', 'pending')
            ])
            
            error_syncs = self.env['pos.sync.log'].search_count([
                ('sync_status', '=', 'error')
            ])
            
            conflict_syncs = self.env['pos.sync.log'].search_count([
                ('sync_status', '=', 'conflict')
            ])
            
            return {
                'sync_enabled': self.sync_enabled,
                'offline_mode': self.offline_mode,
                'sync_status': self.sync_status,
                'last_sync': self.last_sync.isoformat() if self.last_sync else None,
                'pending_syncs': pending_syncs,
                'error_syncs': error_syncs,
                'conflict_syncs': conflict_syncs,
                'statistics': {
                    'total_syncs': self.total_syncs,
                    'successful_syncs': self.successful_syncs,
                    'failed_syncs': self.failed_syncs,
                    'conflicts_resolved': self.conflicts_resolved,
                    'success_rate': (self.successful_syncs / max(self.total_syncs, 1)) * 100
                }
            }
            
        except Exception as e:
            _logger.error(f"Failed to get sync status: {e}")
            return {
                'sync_enabled': False,
                'error': str(e)
            }


class SyncLog(models.Model):
    """Enhanced sync log with additional Phase 3 features"""
    _name = 'pos.sync.log'
    _description = 'Data Synchronization Log'
    _order = 'created_at desc'
    
    # Basic sync info
    entity_type = fields.Char('Entity Type', required=True, index=True)
    entity_id = fields.Integer('Entity ID', required=True, index=True)
    action = fields.Selection([
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete')
    ], string='Action', required=True)
    
    # Data tracking
    data_hash = fields.Char('Data Hash', index=True)
    data_payload = fields.Text('Data Payload')
    
    # Sync status
    sync_status = fields.Selection([
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('error', 'Error'),
        ('conflict', 'Conflict')
    ], string='Sync Status', default='pending', index=True)
    
    # Timestamps
    created_at = fields.Datetime('Created At', required=True, index=True)
    synced_at = fields.Datetime('Synced At')
    
    # Session tracking
    session_id = fields.Many2one('pos.session', 'Session')
    user_id = fields.Many2one('res.users', 'User', default=lambda self: self.env.user)
    
    # Error handling
    error_message = fields.Text('Error Message')
    retry_count = fields.Integer('Retry Count', default=0)
    max_retries = fields.Integer('Max Retries', default=3)
    
    # Priority
    priority = fields.Selection([
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('critical', 'Critical')
    ], string='Priority', default='normal')
    
    def retry_sync(self):
        """Retry failed sync operation"""
        for record in self:
            if record.retry_count < record.max_retries:
                record.write({
                    'sync_status': 'pending',
                    'retry_count': record.retry_count + 1,
                    'error_message': None
                })
            else:
                record.write({'sync_status': 'error'})


class SyncConflict(models.Model):
    """Conflict resolution for manual handling"""
    _name = 'pos.sync.conflict'
    _description = 'Sync Conflict Resolution'
    _order = 'created_at desc'
    
    sync_log_id = fields.Many2one('pos.sync.log', 'Sync Log', required=True, ondelete='cascade')
    entity_type = fields.Char('Entity Type', required=True)
    entity_id = fields.Integer('Entity ID', required=True)
    
    # Conflict data
    server_data = fields.Text('Server Data')
    client_data = fields.Text('Client Data')
    conflicts = fields.Text('Conflict Details')
    
    # Resolution
    status = fields.Selection([
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('ignored', 'Ignored')
    ], string='Status', default='pending')
    
    resolution = fields.Selection([
        ('use_server', 'Use Server Data'),
        ('use_client', 'Use Client Data'),
        ('merge', 'Merge Data'),
        ('custom', 'Custom Resolution')
    ], string='Resolution')
    
    resolved_data = fields.Text('Resolved Data')
    
    # Metadata
    created_at = fields.Datetime('Created At', required=True)
    resolved_at = fields.Datetime('Resolved At')
    resolved_by = fields.Many2one('res.users', 'Resolved By')
    notes = fields.Text('Resolution Notes')
    
    def resolve_conflict(self, resolution_type: str, resolved_data: Dict[str, Any] = None):
        """Resolve the conflict"""
        try:
            if resolution_type == 'use_server':
                # Use server data - mark as resolved
                self.write({
                    'status': 'resolved',
                    'resolution': 'use_server',
                    'resolved_at': fields.Datetime.now(),
                    'resolved_by': self.env.user.id
                })
                
            elif resolution_type == 'use_client':
                # Apply client data
                entity = self.env[self.entity_type].browse(self.entity_id)
                client_data = json.loads(self.client_data)
                entity.write(client_data)
                
                self.write({
                    'status': 'resolved',
                    'resolution': 'use_client',
                    'resolved_at': fields.Datetime.now(),
                    'resolved_by': self.env.user.id
                })
                
            elif resolution_type == 'custom' and resolved_data:
                # Apply custom resolution
                entity = self.env[self.entity_type].browse(self.entity_id)
                entity.write(resolved_data)
                
                self.write({
                    'status': 'resolved',
                    'resolution': 'custom',
                    'resolved_data': json.dumps(resolved_data, default=str),
                    'resolved_at': fields.Datetime.now(),
                    'resolved_by': self.env.user.id
                })
            
            # Update related sync log
            self.sync_log_id.write({'sync_status': 'completed'})
            
            return {'success': True}
            
        except Exception as e:
            _logger.error(f"Conflict resolution failed: {e}")
            return {
                'success': False,
                'error': str(e)
            } 