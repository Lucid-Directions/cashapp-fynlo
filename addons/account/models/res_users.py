# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import api, models, _
from cashapp.exceptions import ValidationError


class GroupsView(models.Model):
    _inherit = 'res.groups'

    @api.model
    def get_application_groups(self, domain):
        # Overridden in order to remove 'Show Full Accounting Features' and
        # 'Show Full Accounting Features - Readonly' in the 'res.users' form view to prevent confusion
        group_account_user = self.env.ref('account.group_account_user', raise_if_not_found=False)
        if group_account_user and group_account_user.category_id.xml_id == 'base.module_category_hidden':
            domain += [('id', '!=', group_account_user.id)]
        group_account_readonly = self.env.ref('account.group_account_readonly', raise_if_not_found=False)
        if group_account_readonly and group_account_readonly.category_id.xml_id == 'base.module_category_hidden':
            domain += [('id', '!=', group_account_readonly.id)]
        group_account_basic = self.env.ref('account.group_account_basic', raise_if_not_found=False)
        if group_account_basic and group_account_basic.category_id.xml_id == 'base.module_category_hidden':
            domain += [('id', '!=', group_account_basic.id)]
        return super().get_application_groups(domain)

    @api.model
    def _activate_group_account_secured(self):
        group_account_secured = self.env.ref('account.group_account_secured', raise_if_not_found=False)
        if not group_account_secured:
            return
        groups_with_access = [
            'account.group_account_readonly',
            'account.group_account_invoice',
        ]
        for group_name in groups_with_access:
            group = self.env.ref(group_name, raise_if_not_found=False)
            if group:
                group.sudo()._apply_group(group_account_secured)
