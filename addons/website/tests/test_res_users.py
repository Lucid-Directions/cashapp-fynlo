# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import Command
from cashapp.addons.website.tools import MockRequest
from cashapp.exceptions import ValidationError
from cashapp.service.model import retrying
from cashapp.tests.common import TransactionCase, new_test_user
from cashapp.tools import mute_logger

from unittest import TestCase

import psycopg2


class TestWebsiteResUsers(TransactionCase):

    def setUp(self):
        super().setUp()
        websites = self.env['website'].create([
            {'name': 'Test Website'},
            {'name': 'Test Website 2'},
        ])
        self.website_1, self.website_2 = websites

    def test_no_website(self):
        new_test_user(self.env, login='Pou', website_id=False)
        with self.assertRaises(ValidationError):
            new_test_user(self.env, login='Pou', website_id=False)

    def test_websites_set_null(self):
        user_1 = new_test_user(self.env, login='Pou', website_id=self.website_1.id, groups='base.group_portal')
        user_2 = new_test_user(self.env, login='Pou', website_id=self.website_2.id, groups='base.group_portal')
        with self.assertRaises(ValidationError):
            (user_1 | user_2).write({'website_id': False})

    def test_null_and_website(self):
        new_test_user(self.env, login='Pou', website_id=self.website_1.id, groups='base.group_portal')
        new_test_user(self.env, login='Pou', website_id=False, groups='base.group_portal')

    def test_change_login(self):
        new_test_user(self.env, login='Pou', website_id=self.website_1.id, groups='base.group_portal')
        user_belle = new_test_user(self.env, login='Belle', website_id=self.website_1.id, groups='base.group_portal')
        with self.assertRaises(psycopg2.errors.UniqueViolation), mute_logger('cashapp.sql_db'):
            user_belle.login = 'Pou'

    def test_change_login_no_website(self):
        new_test_user(self.env, login='Pou', website_id=False)
        user_belle = new_test_user(self.env, login='Belle', website_id=False)
        with self.assertRaises(ValidationError):
            user_belle.login = 'Pou'

    def test_same_website_message(self):
        # Use a test cursor because retrying() does commit.
        self.env.registry.enter_test_mode(self.env.cr)
        self.addCleanup(self.env.registry.leave_test_mode)
        env = self.env(context={'lang': 'en_US'}, cr=self.env.registry.cursor())

        def create_user_pou():
            return new_test_user(env, login='Pou', website_id=self.website_1.id, groups='base.group_portal')

        # First user creation works.
        create_user_pou()

        # Second user creation fails with ValidationError instead of
        # IntegrityError. Do not use self.assertRaises as it would try
        # to create and rollback to a savepoint that is removed by the
        # rollback in retrying().
        with TestCase.assertRaises(self, ValidationError), mute_logger('cashapp.sql_db'):
            retrying(create_user_pou, env)

    def _create_user_via_website(self, website, login):
        # We need a fake request to _signup_create_user.
        with MockRequest(self.env, website=website):
            return self.env['res.users'].with_context(website_id=website.id)._signup_create_user({
                'name': login,
                'login': login,
            })

    def _create_and_check_portal_user(self, website_specific, company_1, company_2, website_1, website_2):
        # Disable/Enable cross-website for portal users.
        website_1.specific_user_account = website_specific
        website_2.specific_user_account = website_specific

        user_1 = self._create_user_via_website(website_1, 'user1')
        user_2 = self._create_user_via_website(website_2, 'user2')
        self.assertEqual(user_1.company_id, company_1)
        self.assertEqual(user_2.company_id, company_2)

        if website_specific:
            self.assertEqual(user_1.website_id, website_1)
            self.assertEqual(user_2.website_id, website_2)
        else:
            self.assertEqual(user_1.website_id.id, False)
            self.assertEqual(user_2.website_id.id, False)

    def test_multi_website_multi_company(self):
        company_1 = self.env['res.company'].create({'name': "Company 1"})
        company_2 = self.env['res.company'].create({'name': "Company 2"})
        website_1 = self.env['website'].create({'name': "Website 1", 'company_id': company_1.id})
        website_2 = self.env['website'].create({'name': "Website 2", 'company_id': company_2.id})
        # Permit uninvited signup.
        website_1.auth_signup_uninvited = 'b2c'
        website_2.auth_signup_uninvited = 'b2c'

        self._create_and_check_portal_user(False, company_1, company_2, website_1, website_2)
        self._create_and_check_portal_user(True, company_1, company_2, website_1, website_2)

    def test_archive_company_linked_to_website(self):
        company = self.env['res.company'].create({'name': 'Company'})
        self.env['website'].create({'name': "Website 1", 'company_id': company.id})

        # The company cannot be archived because it has a website linked to it
        with self.assertRaises(ValidationError):
            company.action_archive()

    def test_user_become_internal(self):
        # This tests if the website_id is correctly removed when a user becomes
        # an internal user.
        website = self.env['website'].create({'name': "Awesome Website"})
        website.write({
            # Permit uninvited signup for portal users.
            'auth_signup_uninvited': 'b2c',
            # Disable cross-website for portal users.
            'specific_user_account': True,
        })
        user = self._create_user_via_website(website, 'Portal_User')
        self.assertEqual(user.website_id, website)
        self.assertTrue(user._is_portal())
        with self.assertRaises(ValidationError):
            user.groups_id = [
                Command.link(self.env.ref('base.group_user').id),
                Command.unlink(self.env.ref('base.group_portal').id),
            ]
