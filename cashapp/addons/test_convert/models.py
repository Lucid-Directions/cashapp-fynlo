# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import api, fields, models

class TestModel(models.Model):
    _name = 'test_convert.test_model'
    _description = "Test Convert Model"

    name = fields.Char(translate=True)
    usered_ids = fields.One2many('test_convert.usered', 'test_id')

    @api.model
    def action_test_date(self, today_date):
        return True

    @api.model
    def action_test_time(self, cur_time):
        return True

    @api.model
    def action_test_timezone(self, timezone):
        return True

class Usered(models.Model):
    _name = 'test_convert.usered'
    _description = "z test model ignore"

    name = fields.Char()
    user_id = fields.Many2one('res.users', default=lambda self: self.env.user)
    test_id = fields.Many2one('test_convert.test_model')
    tz = fields.Char(default=lambda self: self.env.context.get('tz') or self.env.user.tz)

    @api.model
    def model_method(self, *args, **kwargs):
        return self, args, kwargs

    def method(self, *args, **kwargs):
        return self, args, kwargs
