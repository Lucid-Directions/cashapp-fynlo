# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

import time
import sys

from cashapp import models, api

class m(models.Model):
    """ This model exposes a few methods that will consume between 'almost no
        resource' and 'a lot of resource'.
    """
    _name = 'test.limits.model'
    _description = 'Test Limits Model'

    @api.model
    def consume_nothing(self):
        return True

    @api.model
    def consume_memory(self, size):
        l = [0] * size
        return True

    @api.model
    def leak_memory(self, size):
        if not hasattr(self, 'l'):
            self.env.registry[self._name].l = []
        self.l.append([0] * size)
        return True

    @api.model
    def consume_time(self, seconds):
        time.sleep(seconds)
        return True

    @api.model
    def consume_cpu_time(self, seconds):
        t0 = time.process_time()
        t1 = time.process_time()
        while t1 - t0 < seconds:
            for i in range(10000000):
                x = i * i
            t1 = time.process_time()
        return True
