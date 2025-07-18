# Part of CashApp. See LICENSE file for full copyright and licensing details.

import inspect

from cashapp.tests.common import TransactionCase, tagged

DEPRECATED_MODEL_ATTRIBUTES = [
    'view_init',
    '_needaction',
    '_sql',
    '_execute_sql',
]


@tagged('-at_install', 'post_install', 'deprecation')
class TestModelDeprecations(TransactionCase):

    def test_model_attributes(self):
        for model_name, Model in self.registry.items():
            for attr in DEPRECATED_MODEL_ATTRIBUTES:
                with self.subTest(model=model_name, attr=attr):
                    value = getattr(Model, attr, None)
                    if value is None:
                        continue
                    msg = f"Deprecated method/attribute {model_name}.{attr}"
                    module = inspect.getmodule(value)
                    if module:
                        msg += f" in {module}"
                    self.fail(msg)

    def test_name_get(self):
        for model_name, Model in self.registry.items():
            with self.subTest(model=model_name):
                if not hasattr(Model, 'name_get'):
                    continue
                module = inspect.getmodule(Model.name_get)
                self.fail(f"Deprecated name_get method found on {model_name} in {module.__name__}, you should override `_compute_display_name` instead")
