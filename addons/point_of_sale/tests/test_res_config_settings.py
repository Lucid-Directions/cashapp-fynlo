# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

import cashapp

from cashapp import Command
from cashapp.addons.point_of_sale.tests.common import TestPoSCommon
from cashapp.tests import Form


@cashapp.tests.tagged('post_install', '-at_install')
class TestConfigureShops(TestPoSCommon):
    """ Shops are now configured from the general settings.
        This test suite ensures that changes made in the general settings
        should reflect to the pos.config record pointed by the
        pos_config_id field.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # If not enabled (like in demo data), landing on res.config will try
        # to disable module_sale_quotation_builder and raise an issue
        group_order_template = cls.env.ref('sale_management.group_sale_order_template', raise_if_not_found=False)
        if group_order_template:
            cls.env.ref('base.group_user').write({"implied_ids": [(4, group_order_template.id)]})

    def _remove_on_payment_taxes(self):
        """ Call this when testing the res.config.settings with Form.
            The `on_payment` taxes need to be removed, otherwise, a warning will show in the log.
        """
        self.env['account.tax'].search([
            ('company_id', '=', self.env.company.id), ('tax_exigibility', '=', 'on_payment')
        ]).unlink()

    def test_should_not_affect_other_pos_config(self):
        """ Change in one pos.config should not reflect to the other.
        """
        self._remove_on_payment_taxes()

        pos_config1 = self.env['pos.config'].create({'name': 'Shop 1', 'module_pos_restaurant': False})
        pos_config2 = self.env['pos.config'].create({'name': 'Shop 2', 'module_pos_restaurant': False})
        self.assertEqual(pos_config1.receipt_header, False)
        self.assertEqual(pos_config2.receipt_header, False)

        # Modify Shop 1.
        with Form(self.env['res.config.settings']) as form:
            form.pos_config_id = pos_config1
            form.pos_is_header_or_footer = True
            form.pos_receipt_header = 'xxxxx'

        self.assertEqual(pos_config1.receipt_header, 'xxxxx')
        self.assertEqual(pos_config2.receipt_header, False)

        # Modify Shop 2.
        with Form(self.env['res.config.settings']) as form:
            form.pos_config_id = pos_config2
            form.pos_is_header_or_footer = True
            form.pos_receipt_header = 'yyyyy'

        self.assertEqual(pos_config1.receipt_header, 'xxxxx')
        self.assertEqual(pos_config2.receipt_header, 'yyyyy')

    def test_is_header_or_footer_to_false(self):
        self._remove_on_payment_taxes()

        pos_config = self.env['pos.config'].create({
            'name': 'Shop',
            'is_header_or_footer': True,
            'module_pos_restaurant': False,
            'receipt_header': 'header val',
            'receipt_footer': 'footer val',
        })

        with Form(self.env['res.config.settings']) as form:
            form.pos_config_id = pos_config
            form.pos_is_header_or_footer = False

        self.assertEqual(pos_config.receipt_header, False)
        self.assertEqual(pos_config.receipt_footer, False)

    def test_properly_set_pos_config_x2many_fields(self):
        """Simulate what is done from the res.config.settings view when editing x2 many fields."""

        self._remove_on_payment_taxes()
        pos_config = self.env['pos.config'].create({
            'name': 'Shop 1',
            'module_pos_restaurant': False,
            'payment_method_ids': [
                Command.create({
                    'name': 'Bank 1',
                    'receivable_account_id': self.env.company.account_default_pos_receivable_account_id.id,
                    'is_cash_count': False,
                    'split_transactions': False,
                    'company_id': self.env.company.id,
                }),
                Command.create({
                    'name': 'Bank 2',
                    'receivable_account_id': self.env.company.account_default_pos_receivable_account_id.id,
                    'is_cash_count': False,
                    'split_transactions': False,
                    'company_id': self.env.company.id,
                }),
                Command.create({
                    'name': 'Cash',
                    'receivable_account_id': self.env.company.account_default_pos_receivable_account_id.id,
                    'is_cash_count': True,
                    'company_id': self.env.company.id,
                })
            ]
        })

        # Manually simulate the unlinking of the second record and then save the settings.
        # It will be a set of link commands except the one we want to delete.
        linked_ids = pos_config.payment_method_ids.ids
        second_id = linked_ids[1]
        commands = [Command.link(_id) for _id in linked_ids if _id != second_id]

        pos_config.with_context(from_settings_view=True).write({
            'payment_method_ids': commands
        })

        self.assertTrue(second_id not in pos_config.payment_method_ids.ids)
        self.assertTrue(len(pos_config.payment_method_ids) == 2)
