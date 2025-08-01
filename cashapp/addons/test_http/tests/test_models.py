# Part of CashApp. See LICENSE file for full copyright and licensing details.

from http import HTTPStatus

import cashapp
from cashapp.tests import tagged
from cashapp.tests.common import new_test_user, Like
from cashapp.tools import mute_logger
from cashapp.addons.test_http.utils import HtmlTokenizer

from .test_common import TestHttpBase


@tagged('post_install', '-at_install')
class TestHttpModels(TestHttpBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.jackoneill = new_test_user(cls.env, 'jackoneill', context={'lang': 'en_US'})

    def setUp(self):
        super().setUp()
        self.authenticate('jackoneill', 'jackoneill')

    def test_models0_galaxy_ok(self):
        milky_way = self.env.ref('test_http.milky_way')

        res = self.url_open(f"/test_http/{milky_way.id}")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            HtmlTokenizer.tokenize(res.text),
            HtmlTokenizer.tokenize('''\
                <p>Milky Way</p>
                <ul>
                    <li><a href="/test_http/1/1">Earth (P4X-126)</a></li>
                    <li><a href="/test_http/1/2">Abydos (P2X-125)</a></li>
                    <li><a href="/test_http/1/3">Dakara (P5C-113)</a></li>
                </ul>
                ''')
            )

    @mute_logger('cashapp.http')
    def test_models1_galaxy_ko(self):
        res = self.url_open("/test_http/404")  # unknown galaxy
        self.assertEqual(res.status_code, 400)
        self.assertIn('The Ancients did not settle there.', res.text)

    def test_models2_stargate_ok(self):
        milky_way = self.env.ref('test_http.milky_way')
        earth = self.env.ref('test_http.earth')

        res = self.url_open(f'/test_http/{milky_way.id}/{earth.id}')

        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            HtmlTokenizer.tokenize(res.text),
            HtmlTokenizer.tokenize('''\
                <dl>
                    <dt>name</dt><dd>Earth</dd>
                    <dt>address</dt><dd>sq5Abt</dd>
                    <dt>sgc_designation</dt><dd>P4X-126</dd>
                </dl>
            ''')
        )

    @mute_logger('cashapp.http')
    def test_models3_stargate_ko(self):
        milky_way = self.env.ref('test_http.milky_way')
        res = self.url_open(f'/test_http/{milky_way.id}/9999')  # unknown gate
        self.assertEqual(res.status_code, 400)
        self.assertIn("The goauld destroyed the gate", res.text)

    def test_models4_stargate_setname(self):
        milky_way = self.env.ref('test_http.milky_way')


        milky_way.invalidate_recordset()
        res = self.url_open(f'/test_http/{milky_way.id}/setname?readonly=0', {
            'name': "Wilky May",
            'csrf_token': cashapp.http.Request.csrf_token(self),
        })
        res.raise_for_status()

        milky_way.invalidate_recordset()
        self.assertEqual(milky_way.name, "Wilky May")

    def test_models5_stargate_setname_readonly(self):
        milky_way = self.env.ref('test_http.milky_way')

        self.assertEqual(milky_way.name, "Milky Way")

        with self.assertLogs('cashapp.http', 'WARNING') as capture_http,\
             self.assertLogs('cashapp.sql_db', 'WARNING') as capture_sql_db:
            res = self.url_open(f'/test_http/{milky_way.id}/setname?readonly=1', {
                'name': "Wilky May",
                'csrf_token': cashapp.http.Request.csrf_token(self),
            })
            res.raise_for_status()

        milky_way.invalidate_recordset()
        self.assertEqual(milky_way.name, "Wilky May")
        self.assertEqual(capture_http.output, [
            Like("...cannot execute UPDATE in a read-only transaction, retrying with a read/write cursor..."),
        ])
        self.assertEqual(
            # capture_sql_db.ouput contains the full Stack info, we don't want it
            [rec.msg % rec.args for rec in capture_sql_db.records],
            [Like('bad query:...UPDATE "test_http_galaxy"...ERROR: cannot execute UPDATE in a read-only transaction')],
        )

    def test_models5_max_upload_too_large(self):
        res = self.url_open('/test_http/1/setname', {
            'name': "too much data" * 1000  # 1.3kB
        })
        self.assertEqual(res.status_code, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
