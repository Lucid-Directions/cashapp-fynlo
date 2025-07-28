import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from odoo import http, fields
from odoo.http import request, Response
from odoo.exceptions import ValidationError, UserError, AccessError

_logger = logging.getLogger(__name__)


class Phase3API(http.Controller):
    """Phase 3 API Controller - Data Sync & Employee Management"""
    
    # ====================
    # DATA SYNCHRONIZATION ENDPOINTS
    # ====================
    
    @http.route('/api/sync/status', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_sync_status(self):
        """Get comprehensive sync status"""
        try:
            sync_service = request.env['pos.data.sync.service'].search([], limit=1)
            if not sync_service:
                sync_service = request.env['pos.data.sync.service'].create({})
            
            status = sync_service.get_sync_status()
            
            return {
                'success': True,
                'data': status,
                'timestamp': fields.Datetime.now().isoformat()
            }
            
        except Exception as e:
            _logger.error(f"Get sync status failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'SYNC_STATUS_ERROR'
            }
    
    @http.route('/api/sync/process', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def process_sync_queue(self, session_id=None):
        """Process offline sync queue"""
        try:
            sync_service = request.env['pos.data.sync.service'].search([], limit=1)
            if not sync_service:
                sync_service = request.env['pos.data.sync.service'].create({})
            
            results = sync_service.process_offline_queue(session_id)
            
            return {
                'success': True,
                'data': results,
                'timestamp': fields.Datetime.now().isoformat()
            }
            
        except Exception as e:
            _logger.error(f"Process sync queue failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'SYNC_PROCESS_ERROR'
            }
    
    @http.route('/api/sync/create', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def create_sync_record(self, model_name, record_id, action, data=None):
        """Create sync record for data change"""
        try:
            # Validate inputs
            if not model_name or not record_id or not action:
                return {
                    'success': False,
                    'error': 'Missing required parameters',
                    'error_code': 'INVALID_PARAMS'
                }
            
            sync_service = request.env['pos.data.sync.service'].search([], limit=1)
            if not sync_service:
                sync_service = request.env['pos.data.sync.service'].create({})
            
            sync_record_id = sync_service.create_sync_record(
                model_name, record_id, action, data or {}
            )
            
            if sync_record_id:
                return {
                    'success': True,
                    'sync_record_id': sync_record_id,
                    'message': 'Sync record created successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to create sync record',
                    'error_code': 'SYNC_CREATE_ERROR'
                }
                
        except Exception as e:
            _logger.error(f"Create sync record failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'SYNC_CREATE_ERROR'
            }
    
    @http.route('/api/sync/conflicts', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_sync_conflicts(self, limit=50, offset=0):
        """Get pending sync conflicts"""
        try:
            conflicts = request.env['pos.sync.conflict'].search([
                ('status', '=', 'pending')
            ], limit=limit, offset=offset, order='created_at desc')
            
            conflict_data = []
            for conflict in conflicts:
                conflict_data.append({
                    'id': conflict.id,
                    'entity_type': conflict.entity_type,
                    'entity_id': conflict.entity_id,
                    'conflicts': json.loads(conflict.conflicts) if conflict.conflicts else [],
                    'server_data': json.loads(conflict.server_data) if conflict.server_data else {},
                    'client_data': json.loads(conflict.client_data) if conflict.client_data else {},
                    'created_at': conflict.created_at.isoformat(),
                    'status': conflict.status
                })
            
            return {
                'success': True,
                'data': conflict_data,
                'total_count': len(conflicts),
                'has_more': len(conflicts) == limit
            }
            
        except Exception as e:
            _logger.error(f"Get sync conflicts failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CONFLICTS_GET_ERROR'
            }
    
    @http.route('/api/sync/resolve-conflict', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def resolve_conflict(self, conflict_id, resolution_type, resolved_data=None):
        """Resolve sync conflict"""
        try:
            conflict = request.env['pos.sync.conflict'].browse(conflict_id)
            if not conflict.exists():
                return {
                    'success': False,
                    'error': 'Conflict not found',
                    'error_code': 'CONFLICT_NOT_FOUND'
                }
            
            result = conflict.resolve_conflict(resolution_type, resolved_data)
            
            return {
                'success': result['success'],
                'message': 'Conflict resolved successfully' if result['success'] else result.get('error'),
                'conflict_id': conflict_id
            }
            
        except Exception as e:
            _logger.error(f"Resolve conflict failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CONFLICT_RESOLVE_ERROR'
            }
    
    # ====================
    # EMPLOYEE TIME CLOCK ENDPOINTS
    # ====================
    
    @http.route('/api/timeclock/clock-in', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def clock_in(self, employee_id, pin=None, location=None, session_id=None, device_info=None):
        """Clock in an employee"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.clock_in(
                employee_id, pin, location, session_id, device_info
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Clock in API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CLOCK_IN_API_ERROR'
            }
    
    @http.route('/api/timeclock/clock-out', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def clock_out(self, employee_id, pin=None, location=None, device_info=None):
        """Clock out an employee"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.clock_out(
                employee_id, pin, location, device_info
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Clock out API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CLOCK_OUT_API_ERROR'
            }
    
    @http.route('/api/timeclock/start-break', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def start_break(self, employee_id, break_type='regular'):
        """Start a break for an employee"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.start_break(employee_id, break_type)
            
            return result
            
        except Exception as e:
            _logger.error(f"Start break API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'START_BREAK_API_ERROR'
            }
    
    @http.route('/api/timeclock/end-break', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def end_break(self, employee_id):
        """End a break for an employee"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.end_break(employee_id)
            
            return result
            
        except Exception as e:
            _logger.error(f"End break API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'END_BREAK_API_ERROR'
            }
    
    @http.route('/api/timeclock/status/<int:employee_id>', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_employee_status(self, employee_id):
        """Get current time clock status for an employee"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.get_current_status(employee_id)
            
            return result
            
        except Exception as e:
            _logger.error(f"Get employee status API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'STATUS_API_ERROR'
            }
    
    @http.route('/api/timeclock/adjust-time', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def adjust_time(self, timecard_id, adjustment_data, reason, manager_id):
        """Adjust time for a timecard (manager approval required)"""
        try:
            timeclock_service = request.env['pos.employee.timeclock.service'].search([], limit=1)
            if not timeclock_service:
                timeclock_service = request.env['pos.employee.timeclock.service'].create({})
            
            result = timeclock_service.adjust_time(
                timecard_id, adjustment_data, reason, manager_id
            )
            
            return result
            
        except Exception as e:
            _logger.error(f"Adjust time API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'ADJUST_TIME_API_ERROR'
            }
    
    @http.route('/api/timeclock/timecards', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_timecards(self, employee_id=None, date_from=None, date_to=None, limit=50, offset=0):
        """Get timecards with filtering"""
        try:
            domain = []
            
            if employee_id:
                domain.append(('employee_id', '=', employee_id))
            
            if date_from:
                domain.append(('work_date', '>=', date_from))
            
            if date_to:
                domain.append(('work_date', '<=', date_to))
            
            timecards = request.env['pos.employee.timecard'].search(
                domain, limit=limit, offset=offset, order='clock_in_time desc'
            )
            
            timecard_data = []
            for timecard in timecards:
                timecard_data.append({
                    'id': timecard.id,
                    'employee_id': timecard.employee_id.id,
                    'employee_name': timecard.employee_id.name,
                    'clock_in_time': timecard.clock_in_time.isoformat(),
                    'clock_out_time': timecard.clock_out_time.isoformat() if timecard.clock_out_time else None,
                    'hours_worked': timecard.hours_worked,
                    'overtime_hours': timecard.overtime_hours,
                    'break_time': timecard.break_time,
                    'status': timecard.status,
                    'work_date': timecard.work_date.isoformat(),
                    'clock_in_adjusted': timecard.clock_in_adjusted,
                    'clock_out_adjusted': timecard.clock_out_adjusted,
                    'breaks': [{
                        'id': b.id,
                        'start_time': b.start_time.isoformat(),
                        'end_time': b.end_time.isoformat() if b.end_time else None,
                        'duration_minutes': b.duration_minutes,
                        'break_type': b.break_type,
                        'status': b.status
                    } for b in timecard.break_ids]
                })
            
            return {
                'success': True,
                'data': timecard_data,
                'total_count': len(timecards),
                'has_more': len(timecards) == limit
            }
            
        except Exception as e:
            _logger.error(f"Get timecards API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'TIMECARDS_API_ERROR'
            }
    
    # ====================
    # EMPLOYEE MANAGEMENT ENDPOINTS
    # ====================
    
    @http.route('/api/employees', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_employees(self, active_only=True, search=None, limit=50, offset=0):
        """Get employees list"""
        try:
            domain = []
            
            if active_only:
                domain.append(('active', '=', True))
            
            if search:
                domain.append(('name', 'ilike', search))
            
            employees = request.env['hr.employee'].search(
                domain, limit=limit, offset=offset, order='name asc'
            )
            
            employee_data = []
            for employee in employees:
                employee_data.append({
                    'id': employee.id,
                    'name': employee.name,
                    'email': employee.work_email,
                    'phone': employee.work_phone,
                    'department': employee.department_id.name if employee.department_id else None,
                    'job_title': employee.job_title,
                    'active': employee.active,
                    'is_manager': hasattr(employee, 'is_manager') and employee.is_manager,
                    'employee_number': employee.identification_id,
                    'hire_date': employee.create_date.date().isoformat() if employee.create_date else None
                })
            
            return {
                'success': True,
                'data': employee_data,
                'total_count': len(employees),
                'has_more': len(employees) == limit
            }
            
        except Exception as e:
            _logger.error(f"Get employees API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'EMPLOYEES_API_ERROR'
            }
    
    @http.route('/api/employees/<int:employee_id>', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_employee(self, employee_id):
        """Get specific employee details"""
        try:
            employee = request.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            # Get current timecard
            current_timecard = request.env['pos.employee.timecard'].search([
                ('employee_id', '=', employee_id),
                ('clock_out_time', '=', False)
            ], limit=1)
            
            employee_data = {
                'id': employee.id,
                'name': employee.name,
                'email': employee.work_email,
                'phone': employee.work_phone,
                'department': employee.department_id.name if employee.department_id else None,
                'job_title': employee.job_title,
                'active': employee.active,
                'is_manager': hasattr(employee, 'is_manager') and employee.is_manager,
                'employee_number': employee.identification_id,
                'hire_date': employee.create_date.date().isoformat() if employee.create_date else None,
                'current_timecard': {
                    'id': current_timecard.id,
                    'clock_in_time': current_timecard.clock_in_time.isoformat(),
                    'status': current_timecard.status
                } if current_timecard else None
            }
            
            return {
                'success': True,
                'data': employee_data
            }
            
        except Exception as e:
            _logger.error(f"Get employee API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'EMPLOYEE_GET_API_ERROR'
            }
    
    @http.route('/api/employees', type='json', auth='jwt', methods=['POST'], csrf=False, cors='*')
    def create_employee(self, name, email=None, phone=None, department_id=None, job_title=None, 
                       employee_number=None, pin=None):
        """Create new employee"""
        try:
            # Validate required fields
            if not name:
                return {
                    'success': False,
                    'error': 'Employee name is required',
                    'error_code': 'INVALID_PARAMS'
                }
            
            employee_data = {
                'name': name,
                'work_email': email,
                'work_phone': phone,
                'department_id': department_id,
                'job_title': job_title,
                'identification_id': employee_number,
                'active': True
            }
            
            if pin:
                employee_data['pos_pin'] = pin
            
            employee = request.env['hr.employee'].create(employee_data)
            
            # Create sync record
            sync_service = request.env['pos.data.sync.service'].search([], limit=1)
            if sync_service:
                sync_service.create_sync_record('hr.employee', employee.id, 'create')
            
            return {
                'success': True,
                'data': {
                    'id': employee.id,
                    'name': employee.name,
                    'employee_number': employee.identification_id
                },
                'message': 'Employee created successfully'
            }
            
        except Exception as e:
            _logger.error(f"Create employee API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'EMPLOYEE_CREATE_API_ERROR'
            }
    
    @http.route('/api/employees/<int:employee_id>', type='json', auth='jwt', methods=['PUT'], csrf=False, cors='*')
    def update_employee(self, employee_id, **kwargs):
        """Update employee information"""
        try:
            employee = request.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            # Filter allowed fields
            allowed_fields = ['name', 'work_email', 'work_phone', 'department_id', 
                            'job_title', 'identification_id', 'active', 'pos_pin']
            
            update_data = {k: v for k, v in kwargs.items() if k in allowed_fields}
            
            if update_data:
                employee.write(update_data)
                
                # Create sync record
                sync_service = request.env['pos.data.sync.service'].search([], limit=1)
                if sync_service:
                    sync_service.create_sync_record('hr.employee', employee_id, 'update', update_data)
            
            return {
                'success': True,
                'data': {
                    'id': employee.id,
                    'name': employee.name
                },
                'message': 'Employee updated successfully'
            }
            
        except Exception as e:
            _logger.error(f"Update employee API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'EMPLOYEE_UPDATE_API_ERROR'
            }
    
    @http.route('/api/employees/<int:employee_id>', type='json', auth='jwt', methods=['DELETE'], csrf=False, cors='*')
    def delete_employee(self, employee_id):
        """Delete/deactivate employee"""
        try:
            employee = request.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            # Check if employee has active timecards
            active_timecard = request.env['pos.employee.timecard'].search([
                ('employee_id', '=', employee_id),
                ('clock_out_time', '=', False)
            ], limit=1)
            
            if active_timecard:
                return {
                    'success': False,
                    'error': 'Cannot delete employee with active timecard. Please clock out first.',
                    'error_code': 'EMPLOYEE_ACTIVE_TIMECARD'
                }
            
            # Deactivate instead of delete to preserve history
            employee.write({'active': False})
            
            # Create sync record
            sync_service = request.env['pos.data.sync.service'].search([], limit=1)
            if sync_service:
                sync_service.create_sync_record('hr.employee', employee_id, 'update', {'active': False})
            
            return {
                'success': True,
                'message': 'Employee deactivated successfully'
            }
            
        except Exception as e:
            _logger.error(f"Delete employee API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'EMPLOYEE_DELETE_API_ERROR'
            }
    
    # ====================
    # REPORTING ENDPOINTS
    # ====================
    
    @http.route('/api/reports/labor-summary', type='json', auth='jwt', methods=['GET'], csrf=False, cors='*')
    def get_labor_summary(self, date_from=None, date_to=None):
        """Get labor summary report"""
        try:
            domain = []
            
            if date_from:
                domain.append(('work_date', '>=', date_from))
            
            if date_to:
                domain.append(('work_date', '<=', date_to))
            
            timecards = request.env['pos.employee.timecard'].search(domain)
            
            # Calculate summary
            total_hours = sum(timecards.mapped('hours_worked'))
            total_overtime = sum(timecards.mapped('overtime_hours'))
            total_employees = len(timecards.mapped('employee_id'))
            
            # Group by employee
            employee_summary = {}
            for timecard in timecards:
                emp_id = timecard.employee_id.id
                if emp_id not in employee_summary:
                    employee_summary[emp_id] = {
                        'employee_name': timecard.employee_id.name,
                        'total_hours': 0,
                        'overtime_hours': 0,
                        'shifts': 0
                    }
                
                employee_summary[emp_id]['total_hours'] += timecard.hours_worked
                employee_summary[emp_id]['overtime_hours'] += timecard.overtime_hours
                employee_summary[emp_id]['shifts'] += 1
            
            return {
                'success': True,
                'data': {
                    'summary': {
                        'total_hours': round(total_hours, 2),
                        'total_overtime': round(total_overtime, 2),
                        'total_employees': total_employees,
                        'average_hours_per_employee': round(total_hours / max(total_employees, 1), 2)
                    },
                    'employee_breakdown': list(employee_summary.values()),
                    'date_range': {
                        'from': date_from,
                        'to': date_to
                    }
                }
            }
            
        except Exception as e:
            _logger.error(f"Labor summary API failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'LABOR_SUMMARY_API_ERROR'
            }
    
    # ====================
    # HEALTH CHECK ENDPOINT
    # ====================
    
    @http.route('/api/phase3/health', type='json', auth='public', methods=['GET'], csrf=False, cors='*')
    def health_check(self):
        """Phase 3 health check endpoint"""
        try:
            # Check sync service
            sync_service = request.env['pos.data.sync.service'].sudo().search([], limit=1)
            sync_healthy = bool(sync_service and sync_service.active)
            
            # Check timeclock service
            timeclock_service = request.env['pos.employee.timeclock.service'].sudo().search([], limit=1)
            timeclock_healthy = bool(timeclock_service and timeclock_service.active)
            
            # Check database connections
            try:
                request.env.cr.execute("SELECT 1")
                db_healthy = True
            except:
                db_healthy = False
            
            # Overall health
            overall_healthy = sync_healthy and timeclock_healthy and db_healthy
            
            return {
                'success': True,
                'healthy': overall_healthy,
                'services': {
                    'data_sync': {
                        'healthy': sync_healthy,
                        'status': 'operational' if sync_healthy else 'down'
                    },
                    'timeclock': {
                        'healthy': timeclock_healthy,
                        'status': 'operational' if timeclock_healthy else 'down'
                    },
                    'database': {
                        'healthy': db_healthy,
                        'status': 'operational' if db_healthy else 'down'
                    }
                },
                'timestamp': fields.Datetime.now().isoformat(),
                'phase': 'Phase 3 - Data Sync & Employee Management'
            }
            
        except Exception as e:
            _logger.error(f"Phase 3 health check failed: {e}")
            return {
                'success': False,
                'healthy': False,
                'error': str(e),
                'timestamp': fields.Datetime.now().isoformat()
            } 