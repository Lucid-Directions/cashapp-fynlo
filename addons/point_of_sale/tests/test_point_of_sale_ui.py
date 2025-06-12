# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp.tests import HttpCase, tagged
from cashapp import tools


@tagged('post_install', '-at_install')
class TestUi(HttpCase):

	# Avoid "A Chart of Accounts is not yet installed in your current company."
	# Everything is set up correctly even without installed CoA
    @tools.mute_logger('cashapp.http')
    def test_01_point_of_sale_tour(self):

        self.start_tour("/cashapp", 'point_of_sale_tour', login="admin")
