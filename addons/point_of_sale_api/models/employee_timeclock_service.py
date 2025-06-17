import logging
import json
from datetime import datetime, timedelta, date
from typing import Dict, Any, Optional, List
from decimal import Decimal

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from odoo.tools import float_compare

_logger = logging.getLogger(__name__)


class EmployeeTimeclockService(models.Model):
    """Comprehensive Employee Time Clock Service for Phase 3"""
    _name = 'pos.employee.timeclock.service'
    _description = 'Employee Time Clock Service'
    
    # Configuration
    name = fields.Char('Service Name', default='Employee Time Clock Service')
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    
    # Time clock settings
    clock_enabled = fields.Boolean('Time Clock Enabled', default=True)
    require_pin = fields.Boolean('Require PIN for Clock In/Out', default=True)
    auto_break_time = fields.Integer('Auto Break Time (minutes)', default=30, 
                                    help="Automatic break time after this many minutes")
    max_shift_hours = fields.Float('Maximum Shift Hours', default=12.0)
    overtime_threshold = fields.Float('Overtime Threshold (hours)', default=8.0)
    grace_period = fields.Integer('Grace Period (minutes)', default=5,
                                 help="Grace period for late clock-in/early clock-out")
    
    # Fraud prevention
    location_tracking = fields.Boolean('Location Tracking', default=True)
    ip_restriction = fields.Boolean('IP Address Restriction', default=False)
    allowed_ips = fields.Text('Allowed IP Addresses')
    photo_verification = fields.Boolean('Photo Verification', default=False)
    
    # Notification settings
    break_reminders = fields.Boolean('Break Reminders', default=True)
    overtime_alerts = fields.Boolean('Overtime Alerts', default=True)
    late_arrival_alerts = fields.Boolean('Late Arrival Alerts', default=True)
    
    # Status
    active = fields.Boolean('Active', default=True)
    
    # Statistics
    total_clock_ins = fields.Integer('Total Clock Ins', default=0)
    total_clock_outs = fields.Integer('Total Clock Outs', default=0)
    fraud_attempts = fields.Integer('Fraud Attempts', default=0)
    
    @api.model
    def clock_in(self, employee_id: int, pin: str = None, location: Dict[str, Any] = None, 
                 session_id: int = None, device_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Clock in an employee"""
        try:
            employee = self.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            # Validate employee status
            validation_result = self._validate_employee_clock_in(employee, pin, location, device_info)
            if not validation_result['success']:
                return validation_result
            
            # Check if already clocked in
            current_timecard = self._get_current_timecard(employee)
            if current_timecard and not current_timecard.clock_out_time:
                return {
                    'success': False,
                    'error': 'Employee is already clocked in',
                    'error_code': 'ALREADY_CLOCKED_IN',
                    'current_timecard_id': current_timecard.id
                }
            
            # Create new timecard
            clock_in_time = fields.Datetime.now()
            timecard = self.env['pos.employee.timecard'].create({
                'employee_id': employee_id,
                'clock_in_time': clock_in_time,
                'session_id': session_id,
                'clock_in_location': json.dumps(location or {}, default=str),
                'clock_in_device': json.dumps(device_info or {}, default=str),
                'status': 'active'
            })
            
            # Update statistics
            self.total_clock_ins += 1
            
            # Create sync record
            self._create_sync_record('pos.employee.timecard', timecard.id, 'create')
            
            # Send notifications
            self._send_clock_notification(employee, 'clock_in', clock_in_time)
            
            # Schedule break reminder
            if self.break_reminders and self.auto_break_time > 0:
                self._schedule_break_reminder(timecard.id, self.auto_break_time)
            
            return {
                'success': True,
                'timecard_id': timecard.id,
                'clock_in_time': clock_in_time.isoformat(),
                'employee_name': employee.name,
                'message': f'Successfully clocked in at {clock_in_time.strftime("%H:%M")}'
            }
            
        except Exception as e:
            _logger.error(f"Clock in failed for employee {employee_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CLOCK_IN_ERROR'
            }
    
    @api.model
    def clock_out(self, employee_id: int, pin: str = None, location: Dict[str, Any] = None,
                  device_info: Dict[str, Any] = None) -> Dict[str, Any]:
        """Clock out an employee"""
        try:
            employee = self.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            # Validate employee status
            validation_result = self._validate_employee_clock_out(employee, pin, location, device_info)
            if not validation_result['success']:
                return validation_result
            
            # Get current timecard
            current_timecard = self._get_current_timecard(employee)
            if not current_timecard or current_timecard.clock_out_time:
                return {
                    'success': False,
                    'error': 'Employee is not currently clocked in',
                    'error_code': 'NOT_CLOCKED_IN'
                }
            
            # Clock out
            clock_out_time = fields.Datetime.now()
            current_timecard.write({
                'clock_out_time': clock_out_time,
                'clock_out_location': json.dumps(location or {}, default=str),
                'clock_out_device': json.dumps(device_info or {}, default=str),
                'status': 'completed'
            })
            
            # Calculate hours worked
            hours_worked = self._calculate_hours_worked(current_timecard)
            current_timecard.hours_worked = hours_worked
            
            # Check for overtime
            if hours_worked > self.overtime_threshold:
                current_timecard.overtime_hours = hours_worked - self.overtime_threshold
                if self.overtime_alerts:
                    self._send_overtime_alert(employee, hours_worked)
            
            # Update statistics
            self.total_clock_outs += 1
            
            # Create sync record
            self._create_sync_record('pos.employee.timecard', current_timecard.id, 'update')
            
            # Send notifications
            self._send_clock_notification(employee, 'clock_out', clock_out_time, hours_worked)
            
            return {
                'success': True,
                'timecard_id': current_timecard.id,
                'clock_out_time': clock_out_time.isoformat(),
                'hours_worked': hours_worked,
                'overtime_hours': current_timecard.overtime_hours,
                'employee_name': employee.name,
                'message': f'Successfully clocked out at {clock_out_time.strftime("%H:%M")} - {hours_worked:.2f} hours worked'
            }
            
        except Exception as e:
            _logger.error(f"Clock out failed for employee {employee_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'CLOCK_OUT_ERROR'
            }
    
    @api.model
    def start_break(self, employee_id: int, break_type: str = 'regular') -> Dict[str, Any]:
        """Start a break for an employee"""
        try:
            employee = self.env['hr.employee'].browse(employee_id)
            current_timecard = self._get_current_timecard(employee)
            
            if not current_timecard or current_timecard.clock_out_time:
                return {
                    'success': False,
                    'error': 'Employee is not currently clocked in',
                    'error_code': 'NOT_CLOCKED_IN'
                }
            
            # Check if already on break
            active_break = self.env['pos.employee.break'].search([
                ('timecard_id', '=', current_timecard.id),
                ('end_time', '=', False)
            ], limit=1)
            
            if active_break:
                return {
                    'success': False,
                    'error': 'Employee is already on break',
                    'error_code': 'ALREADY_ON_BREAK',
                    'break_id': active_break.id
                }
            
            # Create break record
            break_start_time = fields.Datetime.now()
            break_record = self.env['pos.employee.break'].create({
                'timecard_id': current_timecard.id,
                'employee_id': employee_id,
                'start_time': break_start_time,
                'break_type': break_type,
                'status': 'active'
            })
            
            # Update timecard status
            current_timecard.status = 'on_break'
            
            # Create sync record
            self._create_sync_record('pos.employee.break', break_record.id, 'create')
            
            return {
                'success': True,
                'break_id': break_record.id,
                'start_time': break_start_time.isoformat(),
                'break_type': break_type,
                'message': f'Break started at {break_start_time.strftime("%H:%M")}'
            }
            
        except Exception as e:
            _logger.error(f"Start break failed for employee {employee_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'START_BREAK_ERROR'
            }
    
    @api.model
    def end_break(self, employee_id: int) -> Dict[str, Any]:
        """End a break for an employee"""
        try:
            employee = self.env['hr.employee'].browse(employee_id)
            current_timecard = self._get_current_timecard(employee)
            
            if not current_timecard:
                return {
                    'success': False,
                    'error': 'Employee is not currently clocked in',
                    'error_code': 'NOT_CLOCKED_IN'
                }
            
            # Get active break
            active_break = self.env['pos.employee.break'].search([
                ('timecard_id', '=', current_timecard.id),
                ('end_time', '=', False)
            ], limit=1)
            
            if not active_break:
                return {
                    'success': False,
                    'error': 'Employee is not on break',
                    'error_code': 'NOT_ON_BREAK'
                }
            
            # End break
            break_end_time = fields.Datetime.now()
            break_duration = (break_end_time - active_break.start_time).total_seconds() / 60  # minutes
            
            active_break.write({
                'end_time': break_end_time,
                'duration_minutes': break_duration,
                'status': 'completed'
            })
            
            # Update timecard status
            current_timecard.status = 'active'
            
            # Create sync record
            self._create_sync_record('pos.employee.break', active_break.id, 'update')
            
            return {
                'success': True,
                'break_id': active_break.id,
                'end_time': break_end_time.isoformat(),
                'duration_minutes': break_duration,
                'message': f'Break ended at {break_end_time.strftime("%H:%M")} - {break_duration:.0f} minutes'
            }
            
        except Exception as e:
            _logger.error(f"End break failed for employee {employee_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'END_BREAK_ERROR'
            }
    
    @api.model
    def get_current_status(self, employee_id: int) -> Dict[str, Any]:
        """Get current time clock status for an employee"""
        try:
            employee = self.env['hr.employee'].browse(employee_id)
            
            if not employee.exists():
                return {
                    'success': False,
                    'error': 'Employee not found',
                    'error_code': 'EMPLOYEE_NOT_FOUND'
                }
            
            current_timecard = self._get_current_timecard(employee)
            
            if not current_timecard or current_timecard.clock_out_time:
                return {
                    'success': True,
                    'status': 'clocked_out',
                    'employee_name': employee.name,
                    'message': 'Employee is not currently clocked in'
                }
            
            # Get active break
            active_break = self.env['pos.employee.break'].search([
                ('timecard_id', '=', current_timecard.id),
                ('end_time', '=', False)
            ], limit=1)
            
            # Calculate current hours worked
            current_time = fields.Datetime.now()
            total_break_time = self._calculate_total_break_time(current_timecard)
            work_duration = (current_time - current_timecard.clock_in_time).total_seconds() / 3600  # hours
            hours_worked = work_duration - (total_break_time / 60)  # subtract break time
            
            status_info = {
                'success': True,
                'status': 'on_break' if active_break else 'clocked_in',
                'employee_name': employee.name,
                'timecard_id': current_timecard.id,
                'clock_in_time': current_timecard.clock_in_time.isoformat(),
                'hours_worked': round(hours_worked, 2),
                'total_break_time': total_break_time,
                'is_overtime': hours_worked > self.overtime_threshold
            }
            
            if active_break:
                break_duration = (current_time - active_break.start_time).total_seconds() / 60
                status_info.update({
                    'active_break_id': active_break.id,
                    'break_start_time': active_break.start_time.isoformat(),
                    'break_duration': round(break_duration, 1),
                    'break_type': active_break.break_type
                })
            
            return status_info
            
        except Exception as e:
            _logger.error(f"Get status failed for employee {employee_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'GET_STATUS_ERROR'
            }
    
    @api.model
    def adjust_time(self, timecard_id: int, adjustment_data: Dict[str, Any], reason: str, 
                    manager_id: int) -> Dict[str, Any]:
        """Adjust time for a timecard (manager approval required)"""
        try:
            timecard = self.env['pos.employee.timecard'].browse(timecard_id)
            manager = self.env['hr.employee'].browse(manager_id)
            
            if not timecard.exists():
                return {
                    'success': False,
                    'error': 'Timecard not found',
                    'error_code': 'TIMECARD_NOT_FOUND'
                }
            
            if not manager.exists() or not self._is_manager(manager):
                return {
                    'success': False,
                    'error': 'Manager authorization required',
                    'error_code': 'UNAUTHORIZED'
                }
            
            # Create adjustment record
            adjustment = self.env['pos.timecard.adjustment'].create({
                'timecard_id': timecard_id,
                'manager_id': manager_id,
                'reason': reason,
                'adjustment_data': json.dumps(adjustment_data, default=str),
                'created_at': fields.Datetime.now()
            })
            
            # Apply adjustments
            if 'clock_in_time' in adjustment_data:
                timecard.clock_in_time = adjustment_data['clock_in_time']
                timecard.clock_in_adjusted = True
            
            if 'clock_out_time' in adjustment_data:
                timecard.clock_out_time = adjustment_data['clock_out_time']
                timecard.clock_out_adjusted = True
            
            # Recalculate hours
            if timecard.clock_in_time and timecard.clock_out_time:
                hours_worked = self._calculate_hours_worked(timecard)
                timecard.hours_worked = hours_worked
                
                if hours_worked > self.overtime_threshold:
                    timecard.overtime_hours = hours_worked - self.overtime_threshold
            
            # Create sync record
            self._create_sync_record('pos.employee.timecard', timecard_id, 'update')
            
            return {
                'success': True,
                'adjustment_id': adjustment.id,
                'timecard_id': timecard_id,
                'adjusted_hours': timecard.hours_worked,
                'message': 'Time adjustment completed successfully'
            }
            
        except Exception as e:
            _logger.error(f"Time adjustment failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'ADJUSTMENT_ERROR'
            }
    
    def _validate_employee_clock_in(self, employee, pin: str, location: Dict[str, Any], 
                                   device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Validate employee for clock in"""
        try:
            # Check if employee is active
            if not employee.active:
                return {
                    'success': False,
                    'error': 'Employee account is inactive',
                    'error_code': 'EMPLOYEE_INACTIVE'
                }
            
            # Validate PIN if required
            if self.require_pin:
                if not pin or not self._validate_pin(employee, pin):
                    self.fraud_attempts += 1
                    return {
                        'success': False,
                        'error': 'Invalid PIN',
                        'error_code': 'INVALID_PIN'
                    }
            
            # Location validation
            if self.location_tracking and location:
                location_valid = self._validate_location(location)
                if not location_valid:
                    self.fraud_attempts += 1
                    return {
                        'success': False,
                        'error': 'Invalid location for clock in',
                        'error_code': 'INVALID_LOCATION'
                    }
            
            # IP restriction
            if self.ip_restriction and device_info:
                ip_valid = self._validate_ip_address(device_info.get('ip_address'))
                if not ip_valid:
                    self.fraud_attempts += 1
                    return {
                        'success': False,
                        'error': 'IP address not authorized',
                        'error_code': 'INVALID_IP'
                    }
            
            return {'success': True}
            
        except Exception as e:
            _logger.error(f"Clock in validation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_code': 'VALIDATION_ERROR'
            }
    
    def _validate_employee_clock_out(self, employee, pin: str, location: Dict[str, Any], 
                                    device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Validate employee for clock out"""
        # Similar validation as clock in
        return self._validate_employee_clock_in(employee, pin, location, device_info)
    
    def _validate_pin(self, employee, pin: str) -> bool:
        """Validate employee PIN"""
        try:
            # Get employee PIN (encrypted)
            if hasattr(employee, 'pos_pin') and employee.pos_pin:
                return employee.pos_pin == pin
            return False
        except Exception as e:
            _logger.error(f"PIN validation failed: {e}")
            return False
    
    def _validate_location(self, location: Dict[str, Any]) -> bool:
        """Validate clock in/out location"""
        try:
            # Basic location validation
            lat = location.get('latitude')
            lng = location.get('longitude')
            
            if not lat or not lng:
                return False
            
            # Add business logic for location restrictions
            # For now, accept all valid coordinates
            return True
            
        except Exception as e:
            _logger.error(f"Location validation failed: {e}")
            return False
    
    def _validate_ip_address(self, ip_address: str) -> bool:
        """Validate IP address restriction"""
        try:
            if not self.allowed_ips or not ip_address:
                return True
            
            allowed_list = [ip.strip() for ip in self.allowed_ips.split(',')]
            return ip_address in allowed_list
            
        except Exception as e:
            _logger.error(f"IP validation failed: {e}")
            return False
    
    def _get_current_timecard(self, employee):
        """Get current active timecard for employee"""
        return self.env['pos.employee.timecard'].search([
            ('employee_id', '=', employee.id),
            ('clock_out_time', '=', False)
        ], limit=1)
    
    def _calculate_hours_worked(self, timecard) -> float:
        """Calculate total hours worked for a timecard"""
        try:
            if not timecard.clock_in_time:
                return 0.0
            
            clock_out = timecard.clock_out_time or fields.Datetime.now()
            total_minutes = (clock_out - timecard.clock_in_time).total_seconds() / 60
            
            # Subtract break time
            break_time = self._calculate_total_break_time(timecard)
            work_minutes = total_minutes - break_time
            
            return max(0.0, work_minutes / 60)  # Convert to hours
            
        except Exception as e:
            _logger.error(f"Hours calculation failed: {e}")
            return 0.0
    
    def _calculate_total_break_time(self, timecard) -> float:
        """Calculate total break time in minutes"""
        try:
            breaks = self.env['pos.employee.break'].search([
                ('timecard_id', '=', timecard.id)
            ])
            
            total_break_minutes = 0.0
            current_time = fields.Datetime.now()
            
            for break_record in breaks:
                if break_record.end_time:
                    # Completed break
                    total_break_minutes += break_record.duration_minutes or 0.0
                else:
                    # Active break
                    duration = (current_time - break_record.start_time).total_seconds() / 60
                    total_break_minutes += duration
            
            return total_break_minutes
            
        except Exception as e:
            _logger.error(f"Break time calculation failed: {e}")
            return 0.0
    
    def _is_manager(self, employee) -> bool:
        """Check if employee has manager privileges"""
        try:
            # Check if employee has manager role or permissions
            if hasattr(employee, 'is_manager'):
                return employee.is_manager
            
            # Check user groups
            user = employee.user_id
            if user:
                manager_groups = ['point_of_sale.group_pos_manager', 'hr.group_hr_manager']
                user_groups = user.groups_id.mapped('name')
                return any(group in user_groups for group in manager_groups)
            
            return False
            
        except Exception as e:
            _logger.error(f"Manager check failed: {e}")
            return False
    
    def _create_sync_record(self, model_name: str, record_id: int, action: str):
        """Create sync record for time clock changes"""
        try:
            sync_service = self.env['pos.data.sync.service']
            sync_service.create_sync_record(model_name, record_id, action)
        except Exception as e:
            _logger.error(f"Sync record creation failed: {e}")
    
    def _send_clock_notification(self, employee, event_type: str, timestamp: datetime, 
                                hours_worked: float = None):
        """Send WebSocket notification for clock events"""
        try:
            websocket_service = self.env['pos.websocket.service']
            
            notification_data = {
                'employee_id': employee.id,
                'employee_name': employee.name,
                'event_type': event_type,
                'timestamp': timestamp.isoformat()
            }
            
            if hours_worked is not None:
                notification_data['hours_worked'] = hours_worked
            
            websocket_service.broadcast_event('employee.clock', notification_data)
            
        except Exception as e:
            _logger.error(f"Clock notification failed: {e}")
    
    def _send_overtime_alert(self, employee, hours_worked: float):
        """Send overtime alert"""
        try:
            websocket_service = self.env['pos.websocket.service']
            websocket_service.broadcast_event('employee.overtime', {
                'employee_id': employee.id,
                'employee_name': employee.name,
                'hours_worked': hours_worked,
                'overtime_hours': hours_worked - self.overtime_threshold,
                'timestamp': fields.Datetime.now().isoformat()
            })
        except Exception as e:
            _logger.error(f"Overtime alert failed: {e}")
    
    def _schedule_break_reminder(self, timecard_id: int, minutes: int):
        """Schedule break reminder"""
        try:
            # This would integrate with a job scheduler
            # For now, we'll create a reminder record
            reminder_time = fields.Datetime.now() + timedelta(minutes=minutes)
            
            self.env['pos.break.reminder'].create({
                'timecard_id': timecard_id,
                'reminder_time': reminder_time,
                'status': 'scheduled'
            })
            
        except Exception as e:
            _logger.error(f"Break reminder scheduling failed: {e}")


class EmployeeTimecard(models.Model):
    """Employee Timecard Model"""
    _name = 'pos.employee.timecard'
    _description = 'Employee Timecard'
    _order = 'clock_in_time desc'
    
    # Basic info
    employee_id = fields.Many2one('hr.employee', 'Employee', required=True, ondelete='cascade')
    session_id = fields.Many2one('pos.session', 'POS Session')
    
    # Clock times
    clock_in_time = fields.Datetime('Clock In Time', required=True)
    clock_out_time = fields.Datetime('Clock Out Time')
    
    # Location tracking
    clock_in_location = fields.Text('Clock In Location')
    clock_out_location = fields.Text('Clock Out Location')
    
    # Device tracking
    clock_in_device = fields.Text('Clock In Device Info')
    clock_out_device = fields.Text('Clock Out Device Info')
    
    # Time calculations
    hours_worked = fields.Float('Hours Worked', digits=(8, 2))
    overtime_hours = fields.Float('Overtime Hours', digits=(8, 2), default=0.0)
    break_time = fields.Float('Total Break Time (minutes)', compute='_compute_break_time', store=True)
    
    # Status
    status = fields.Selection([
        ('active', 'Active'),
        ('on_break', 'On Break'),
        ('completed', 'Completed'),
        ('adjusted', 'Adjusted')
    ], string='Status', default='active')
    
    # Adjustments
    clock_in_adjusted = fields.Boolean('Clock In Adjusted', default=False)
    clock_out_adjusted = fields.Boolean('Clock Out Adjusted', default=False)
    
    # Date for reporting
    work_date = fields.Date('Work Date', compute='_compute_work_date', store=True)
    
    @api.depends('clock_in_time')
    def _compute_work_date(self):
        """Compute work date from clock in time"""
        for record in self:
            if record.clock_in_time:
                record.work_date = record.clock_in_time.date()
            else:
                record.work_date = False
    
    @api.depends('break_ids')
    def _compute_break_time(self):
        """Compute total break time"""
        for record in self:
            total_minutes = sum(record.break_ids.mapped('duration_minutes'))
            record.break_time = total_minutes
    
    # Relations
    break_ids = fields.One2many('pos.employee.break', 'timecard_id', 'Breaks')
    adjustment_ids = fields.One2many('pos.timecard.adjustment', 'timecard_id', 'Adjustments')


class EmployeeBreak(models.Model):
    """Employee Break Model"""
    _name = 'pos.employee.break'
    _description = 'Employee Break'
    _order = 'start_time desc'
    
    timecard_id = fields.Many2one('pos.employee.timecard', 'Timecard', required=True, ondelete='cascade')
    employee_id = fields.Many2one('hr.employee', 'Employee', required=True)
    
    start_time = fields.Datetime('Start Time', required=True)
    end_time = fields.Datetime('End Time')
    duration_minutes = fields.Float('Duration (minutes)', digits=(8, 1))
    
    break_type = fields.Selection([
        ('regular', 'Regular Break'),
        ('lunch', 'Lunch Break'),
        ('personal', 'Personal Break'),
        ('emergency', 'Emergency Break')
    ], string='Break Type', default='regular')
    
    status = fields.Selection([
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='active')
    
    notes = fields.Text('Notes')


class TimecardAdjustment(models.Model):
    """Timecard Adjustment Model"""
    _name = 'pos.timecard.adjustment'
    _description = 'Timecard Adjustment'
    _order = 'created_at desc'
    
    timecard_id = fields.Many2one('pos.employee.timecard', 'Timecard', required=True, ondelete='cascade')
    manager_id = fields.Many2one('hr.employee', 'Adjusted By', required=True)
    
    reason = fields.Text('Reason', required=True)
    adjustment_data = fields.Text('Adjustment Data')
    
    created_at = fields.Datetime('Created At', required=True)
    approved = fields.Boolean('Approved', default=True)


class BreakReminder(models.Model):
    """Break Reminder Model"""
    _name = 'pos.break.reminder'
    _description = 'Break Reminder'
    
    timecard_id = fields.Many2one('pos.employee.timecard', 'Timecard', required=True, ondelete='cascade')
    reminder_time = fields.Datetime('Reminder Time', required=True)
    
    status = fields.Selection([
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
        ('dismissed', 'Dismissed'),
        ('expired', 'Expired')
    ], string='Status', default='scheduled')
    
    sent_at = fields.Datetime('Sent At') 