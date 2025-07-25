# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from random import randint

from cashapp import fields, models


class EmployeeCategory(models.Model):

    _name = "hr.employee.category"
    _description = "Employee Category"

    def _get_default_color(self):
        return randint(1, 11)

    name = fields.Char(string="Tag Name", required=True)
    color = fields.Integer(string='Color Index', default=_get_default_color)
    employee_ids = fields.Many2many('hr.employee', 'employee_category_rel', 'category_id', 'employee_id', string='Employees')

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tag name already exists!"),
    ]
