# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp.tests import tagged

from cashapp.addons.product.tests.common import ProductCommon


@tagged('post_install', '-at_install')
class TestProduct(ProductCommon):

    def test_common(self):
        self.assertEqual(self.product.type, 'consu')
        self.assertEqual(self.service_product.type, 'service')

        self.assertFalse(self.pricelist.item_ids)
        self.assertEqual(
            self.env['product.pricelist'].search([]),
            self.pricelist,
        )
        self.assertEqual(
            self.env['res.partner'].search([]).property_product_pricelist,
            self.pricelist,
        )
        self.assertEqual(self.pricelist.currency_id.name, self.currency.name)
