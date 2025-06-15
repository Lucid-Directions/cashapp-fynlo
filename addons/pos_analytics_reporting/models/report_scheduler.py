# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class ReportScheduler(models.Model):
    _name = 'pos.report.scheduler'
    _description = 'POS Report Scheduler'
    _order = 'name'

    name = fields.Char(
        string='Schedule Name',
        required=True
    )
    description = fields.Text(
        string='Description'
    )
    
    # Schedule Configuration
    schedule_type = fields.Selection([
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('custom', 'Custom Interval')
    ], string='Schedule Type', required=True, default='daily')
    
    interval = fields.Integer(
        string='Interval (days)',
        default=1,
        help='For custom schedule type'
    )
    
    # Time Configuration
    schedule_time = fields.Float(
        string='Schedule Time',
        default=9.0,
        help='Time of day to run (24-hour format)'
    )
    
    # Report Configuration
    report_ids = fields.Many2many(
        'pos.custom.report',
        string='Reports to Generate'
    )
    
    # Email Configuration
    email_enabled = fields.Boolean(
        string='Send Email',
        default=False
    )
    email_recipients = fields.Text(
        string='Email Recipients',
        help='Comma-separated email addresses'
    )
    email_subject = fields.Char(
        string='Email Subject',
        default='Scheduled POS Report'
    )
    email_template = fields.Text(
        string='Email Template'
    )
    
    # Status and Control
    active = fields.Boolean(
        string='Active',
        default=True
    )
    last_run = fields.Datetime(
        string='Last Run',
        readonly=True
    )
    next_run = fields.Datetime(
        string='Next Run',
        compute='_compute_next_run',
        store=True
    )
    
    # Execution Log
    execution_log = fields.Text(
        string='Execution Log',
        readonly=True
    )
    
    @api.depends('schedule_type', 'interval', 'schedule_time', 'last_run')
    def _compute_next_run(self):
        for record in self:
            if not record.active:
                record.next_run = False
                continue
            
            base_time = record.last_run or fields.Datetime.now()
            
            if record.schedule_type == 'daily':
                next_date = base_time.date() + timedelta(days=1)
            elif record.schedule_type == 'weekly':
                next_date = base_time.date() + timedelta(days=7)
            elif record.schedule_type == 'monthly':
                # Approximate monthly (30 days)
                next_date = base_time.date() + timedelta(days=30)
            else:  # custom
                next_date = base_time.date() + timedelta(days=record.interval)
            
            # Set time
            hour = int(record.schedule_time)
            minute = int((record.schedule_time - hour) * 60)
            
            record.next_run = datetime.combine(next_date, datetime.min.time().replace(hour=hour, minute=minute))
    
    def action_run_scheduled_reports(self):
        """Run all scheduled reports manually"""
        self.ensure_one()
        
        if not self.report_ids:
            return {'type': 'ir.actions.act_window_close'}
        
        results = []
        for report in self.report_ids:
            try:
                result = report.action_generate_report()
                results.append({
                    'report_name': report.name,
                    'status': 'success',
                    'result': result
                })
            except Exception as e:
                results.append({
                    'report_name': report.name,
                    'status': 'error',
                    'error': str(e)
                })
        
        # Update execution log
        log_entry = f"{fields.Datetime.now()}: Manual execution\n"
        for result in results:
            log_entry += f"  - {result['report_name']}: {result['status']}\n"
        
        self.execution_log = (self.execution_log or '') + log_entry
        self.last_run = fields.Datetime.now()
        
        # Send email if configured
        if self.email_enabled and self.email_recipients:
            self._send_email_report(results)
        
        return {
            'type': 'ir.actions.act_window',
            'name': 'Report Results',
            'view_mode': 'form',
            'res_model': self._name,
            'res_id': self.id,
            'target': 'new'
        }
    
    def _send_email_report(self, results):
        """Send email with report results"""
        try:
            mail_template = self.env.ref('mail.mail_template_data_notification_email_default')
            
            # Prepare email content
            subject = self.email_subject or f"Scheduled POS Report - {self.name}"
            
            body = self.email_template or """
            <p>Hello,</p>
            <p>Your scheduled POS reports have been generated:</p>
            <ul>
            """
            
            for result in results:
                status_icon = "✅" if result['status'] == 'success' else "❌"
                body += f"<li>{status_icon} {result['report_name']}: {result['status']}</li>"
            
            body += """
            </ul>
            <p>Best regards,<br/>
            POS Analytics System</p>
            """
            
            # Send to each recipient
            recipients = [email.strip() for email in self.email_recipients.split(',') if email.strip()]
            
            for recipient in recipients:
                mail_values = {
                    'subject': subject,
                    'body_html': body,
                    'email_to': recipient,
                }
                mail = self.env['mail.mail'].create(mail_values)
                mail.send()
                
        except Exception as e:
            _logger.error(f"Failed to send scheduled report email: {str(e)}")
    
    @api.model
    def cron_run_scheduled_reports(self):
        """Cron job to run scheduled reports"""
        now = fields.Datetime.now()
        
        # Find schedulers that need to run
        schedulers = self.search([
            ('active', '=', True),
            ('next_run', '<=', now)
        ])
        
        for scheduler in schedulers:
            try:
                scheduler.action_run_scheduled_reports()
            except Exception as e:
                _logger.error(f"Failed to run scheduled report {scheduler.name}: {str(e)}")
                
                # Log error
                log_entry = f"{now}: Automatic execution failed - {str(e)}\n"
                scheduler.execution_log = (scheduler.execution_log or '') + log_entry 