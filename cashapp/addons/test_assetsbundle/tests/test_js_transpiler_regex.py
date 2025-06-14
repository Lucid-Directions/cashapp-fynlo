# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp.tests import tagged
from cashapp.tests.common import TransactionCase
from cashapp.tools import URL_RE, CASHAPP_MODULE_RE

@tagged('post_install', '-at_install')
class TestJSTranspilerRegex(TransactionCase):

    def test_correct_CASHAPP_MODULE_RE(self):
        """
        This test checks what the correct cases for the transpiler regex.
        In short, the transpiler is ran on files starting with the @cashapp-module annotation.
        The @cashapp-module annotation can have optional parameters:
        - @cashapp-module alias=web.test
        - @cashapp-module default=false
        - @cashapp-module alias=web.test default=false
        """
        for case in [
            '/** @cashapp-module */',
            '// @cashapp-module',
            ' /* @cashapp-module */',
            'if (something) {\n\t// @cashapp-module alias=web.test\n}',
            'if (something) {\n\t/* @cashapp-module alias=web.test */\n}',
            'if (something) {\n\t/* there are some comments around the element @cashapp-module alias=web.test */\n}',
            'if (something) {\n\t// there are some comments around the element @cashapp-module default=false\n}',
            'if (something) {\n\t/* there are some comments around the element @cashapp-module alias=web.test default=false */\n}',
        ]:
            assert CASHAPP_MODULE_RE.match(case), "URL_RE is failing... >%s<" % case
        for case in [
            'if (something) {\n\t/* there are some comments around the element @cashapp-module alias=web.test */\n}',
            'if (something) {\n\t/* @cashapp-module alias=web.test */\n}',
        ]:
            assert CASHAPP_MODULE_RE.match(case).groupdict().get('alias'), "URL_RE is failing for alias... >%s<" % case
            assert CASHAPP_MODULE_RE.match(case).groupdict().get('alias') == "web.test", "URL_RE does not get the right alias for ... >%s<" % case
        for case in ['if (something) {\n\t/* there are some comments around the element @cashapp-module alias=web.test default=false */\n}']:
            assert CASHAPP_MODULE_RE.match(case).groupdict().get('default'), "URL_RE is failing for default... >%s<" % case
            assert CASHAPP_MODULE_RE.match(case).groupdict().get('default') == "false", "URL_RE does not get the right default for ... >%s<" % case

    def test_incorrect_CASHAPP_MODULE_RE(self):
        """
        This test checks that the regex fail when expected.
        """
        for case in [
            '/** @cashapp-module2 */',
            'if (something) { /** @cashapp-module2 */ }',
        ]:
            assert not CASHAPP_MODULE_RE.match(case), "URL_RE should fail but didn't... >%s<" % case
        # test that there is too much spacing
        for case in ['if (something) {\n\t/* @cashapp-module alias= web.test */\n}']:
            assert not CASHAPP_MODULE_RE.match(case).groupdict().get('alias'), "URL_RE should fail because of too much spaces but didn't... >%s<" % case

        for case in [
            'if (something) {\n\t/* @cashapp-module alias=web.test default= false */\n}',
            'if (something) {\n\t/* @cashapp-module alias= web.test default=false */\n}',
            'if (something) {\n\t/* @cashapp-module alias = web.test default = false */\n}',
        ]:
            assert (
                not CASHAPP_MODULE_RE.match(case).groupdict().get('alias') \
                or \
                not CASHAPP_MODULE_RE.match(case).groupdict().get('default')
            ), "URL_RE should fail for alias and default... >%s<" % case
        for case in ['if (something) {\n\t/* @cashapp-module alias =web.test */\n}']:
            assert not CASHAPP_MODULE_RE.match(case).groupdict().get('alias'), "URL_RE should fail for alias... >%s<" % case

    def test_correct_URL_RE(self):
        cases = [
            'web/static/src/js/file.js',
            '/web/static/src/js/file.js',
            '/web/other/static/src/js/file.js',
            '/web/other/static/src/file.js',
            '/web/other/static/tests/file.js',
            '/web/other/static/src/another/and/file.js',
            '/web/other-o/static/src/another/and/file.js',
            '/web-o/other-o/static/src/another/and/file.js',
        ]

        for case in cases:
            assert URL_RE.fullmatch(case), "URL RE failed... %s" % case

    def test_incorrect_URL_RE(self):
        cases = [
            'web/static/js/src/file.js',                          # src after js
            'web/static/js/file.js',                              # no src or tests folder
        ]

        for case in cases:
            assert not URL_RE.fullmatch(case), "URL RE should have failed... %s" % case
