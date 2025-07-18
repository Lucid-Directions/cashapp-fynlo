# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import _, api, exceptions, fields, models


class SMSRecipient(models.TransientModel):
    _name = 'sms.resend.recipient'
    _description = 'Resend Notification'
    _rec_name = 'sms_resend_id'

    sms_resend_id = fields.Many2one('sms.resend', required=True)
    notification_id = fields.Many2one('mail.notification', required=True, ondelete='cascade')
    resend = fields.Boolean(string='Try Again', default=True)
    failure_type = fields.Selection(
        related='notification_id.failure_type', string='Error Message', related_sudo=True, readonly=True)
    partner_id = fields.Many2one('res.partner', 'Partner', related='notification_id.res_partner_id', readonly=True)
    partner_name = fields.Char(string='Recipient Name', readonly=True)
    sms_number = fields.Char(string='Phone Number')


class SMSResend(models.TransientModel):
    _name = 'sms.resend'
    _description = 'SMS Resend'
    _rec_name = 'mail_message_id'

    @api.model
    def default_get(self, fields):
        result = super(SMSResend, self).default_get(fields)
        if 'recipient_ids' in fields and result.get('mail_message_id'):
            mail_message_id = self.env['mail.message'].browse(result['mail_message_id'])
            result['recipient_ids'] = [(0, 0, {
                'notification_id': notif.id,
                'resend': True,
                'failure_type': notif.failure_type,
                'partner_name': notif.res_partner_id.display_name or mail_message_id.record_name,
                'sms_number': notif.sms_number,
            }) for notif in mail_message_id.notification_ids if notif.notification_type == 'sms' and notif.notification_status in ('exception', 'bounce')]
        return result

    mail_message_id = fields.Many2one('mail.message', 'Message', readonly=True, required=True)
    recipient_ids = fields.One2many('sms.resend.recipient', 'sms_resend_id', string='Recipients')
    can_cancel = fields.Boolean(compute='_compute_can_cancel')
    can_resend = fields.Boolean(compute='_compute_can_resend')
    has_insufficient_credit = fields.Boolean(compute='_compute_has_insufficient_credit')
    has_unregistered_account = fields.Boolean(compute='_compute_has_unregistered_account')

    @api.depends("recipient_ids.failure_type")
    def _compute_has_unregistered_account(self):
        self.has_unregistered_account = self.recipient_ids.filtered(lambda p: p.failure_type == 'sms_acc')

    @api.depends("recipient_ids.failure_type")
    def _compute_has_insufficient_credit(self):
        self.has_insufficient_credit = self.recipient_ids.filtered(lambda p: p.failure_type == 'sms_credit')

    @api.depends("recipient_ids.resend")
    def _compute_can_cancel(self):
        self.can_cancel = self.recipient_ids.filtered(lambda p: not p.resend)

    @api.depends('recipient_ids.resend')
    def _compute_can_resend(self):
        self.can_resend = any([recipient.resend for recipient in self.recipient_ids])

    def _check_special_access(self):
        if not self.mail_message_id or not self.mail_message_id.model or not self.mail_message_id.res_id:
            raise exceptions.UserError(_('You do not have access to the message and/or related document.'))
        record = self.env[self.mail_message_id.model].browse(self.mail_message_id.res_id)
        record.check_access('read')

    def action_resend(self):
        self._check_special_access()

        all_notifications = self.env['mail.notification'].sudo().search([
            ('mail_message_id', '=', self.mail_message_id.id),
            ('notification_type', '=', 'sms'),
            ('notification_status', 'in', ('exception', 'bounce'))
        ])
        sudo_self = self.sudo()
        to_cancel_ids = [r.notification_id.id for r in sudo_self.recipient_ids if not r.resend]
        to_resend_ids = [r.notification_id.id for r in sudo_self.recipient_ids if r.resend]

        if to_cancel_ids:
            all_notifications.filtered(lambda n: n.id in to_cancel_ids).write({'notification_status': 'canceled'})

        if to_resend_ids:
            record = self.env[self.mail_message_id.model].browse(self.mail_message_id.res_id)

            sms_pid_to_number = dict((r.partner_id.id, r.sms_number) for  r in self.recipient_ids if r.resend and r.partner_id)
            pids = list(sms_pid_to_number.keys())
            numbers = [r.sms_number for r in self.recipient_ids if r.resend and not r.partner_id]

            recipients_data = []
            all_recipients_data = self.env['mail.followers']._get_recipient_data(record, 'sms', False, pids=pids)[record.id]
            for pid, pdata in all_recipients_data.items():
                if pid and pdata['notif'] == 'sms':
                    recipients_data.append(pdata)
            if recipients_data or numbers:
                record._notify_thread_by_sms(
                    self.mail_message_id, recipients_data,
                    sms_numbers=numbers, sms_pid_to_number=sms_pid_to_number,
                    resend_existing=True, put_in_queue=False
                )

        self.mail_message_id._notify_message_notification_update()
        return {'type': 'ir.actions.act_window_close'}

    def action_cancel(self):
        self._check_special_access()

        sudo_self = self.sudo()
        sudo_self.mapped('recipient_ids.notification_id').write({'notification_status': 'canceled'})
        self.mail_message_id._notify_message_notification_update()
        return {'type': 'ir.actions.act_window_close'}

    def action_buy_credits(self):
        url = self.env['iap.account'].get_credits_url(service_name='sms')
        return {
            'type': 'ir.actions.act_url',
            'url': url,
        }
