# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import models
from cashapp.exceptions import UserError
from cashapp.tools.translate import _


class MailActivitySchedule(models.TransientModel):
    _inherit = 'mail.activity.schedule'

    def action_create_calendar_event(self):
        self.ensure_one()
        if self.is_batch_mode:
            raise UserError(_("Scheduling an activity using the calendar is not possible on more than one record."))
        return self.with_context({
            'default_res_model': self.res_model,
            'default_res_id': self._evaluate_res_ids()[0],
        })._action_schedule_activities().action_create_calendar_event()
