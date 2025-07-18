# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

import datetime

from cashapp.addons.survey.tests import common
from cashapp.exceptions import AccessError, ValidationError
from cashapp.tests import tagged
from cashapp.tests.common import users, HttpCase
from cashapp.tools import mute_logger


@tagged('security')
class TestAccess(common.TestSurveyCommon):

    def setUp(self):
        super(TestAccess, self).setUp()

        self.answer_0 = self._add_answer(self.survey, self.customer)
        self.answer_0_0 = self._add_answer_line(self.question_ft, self.answer_0, 'Test Answer')
        self.answer_0_1 = self._add_answer_line(self.question_num, self.answer_0, 5)

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_emp')
    def test_access_survey_employee(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].create({'title': 'Test Survey 2'})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Page', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Question', 'sequence': 1, 'page_id': self.page_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].search([('title', 'ilike', 'Test')])
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).read(['title'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).write({'question': 'New Title'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_portal')
    def test_access_survey_portal(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].create({'title': 'Test Survey 2'})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Page', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Question', 'sequence': 1, 'page_id': self.page_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].search([('title', 'ilike', 'Test')])
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).read(['title'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).write({'question': 'New Title'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_public')
    def test_access_survey_public(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].create({'title': 'Test Survey 2'})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Page', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.question'].create({'title': 'My Question', 'sequence': 1, 'page_id': self.page_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.survey'].search([('title', 'ilike', 'Test')])
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).read(['title'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).write({'question': 'New Title'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.survey.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.page_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.question_ft.with_user(self.env.user).unlink()

    @users('survey_manager')
    def test_access_survey_survey_manager(self):
        # Create: all
        survey = self.env['survey.survey'].create({'title': 'Test Survey 2'})
        self.env['survey.question'].create({'title': 'My Page', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': survey.id})
        self.env['survey.question'].create({'title': 'My Question', 'sequence': 1, 'survey_id': survey.id})

        # Read: all
        surveys = self.env['survey.survey'].search([('title', 'ilike', 'Test')])
        self.assertEqual(surveys, self.survey | survey)
        surveys.read(['title'])

        # Write: all
        (self.survey | survey).write({'title': 'New Title'})

        # Unlink: all
        (self.survey | survey).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('survey_user')
    def test_access_survey_survey_user(self):
        # Restrict common survey to survey_manager
        restricted_to_other_survey = self.survey
        self.assertEqual(self.survey_manager, restricted_to_other_survey.user_id)
        restricted_to_other_survey.write({'restrict_user_ids': [[4, restricted_to_other_survey.user_id.id]]})

        # Create: restricted to self or no one
        unrestricted_survey = self.env['survey.survey'].create({'title': 'Test Survey Unrestricted'})
        self.env['survey.question'].create({'title': 'My Page', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': unrestricted_survey.id})
        self.env['survey.question'].create({'title': 'My Question', 'sequence': 1, 'survey_id': unrestricted_survey.id})
        restricted_to_self_survey = self.env['survey.survey'].create({'title': 'Test Survey Restricted to Self', 'restrict_user_ids': [[4, self.env.user.id]]})
        with self.assertRaises(ValidationError):
            self.env['survey.survey'].with_user(self.env.user).create({
                'title': 'Test Survey Restricted to Other', 'restrict_user_ids': [[4, restricted_to_other_survey.user_id.id]]})

        # Read: restricted to self or no one
        surveys = self.env['survey.survey'].search([('title', 'ilike', 'Test')])
        self.assertEqual(surveys, restricted_to_self_survey | unrestricted_survey)
        surveys.read(['title'])

        # Write: restricted to self or no one
        (unrestricted_survey + restricted_to_self_survey).write({'title': 'New Title'})
        with self.assertRaises(AccessError):
            restricted_to_other_survey.with_user(self.env.user).write({'title': 'New Title'})

        # Unlink: restricted to self or no one
        (unrestricted_survey + restricted_to_self_survey).unlink()
        with self.assertRaises(AccessError):
            restricted_to_other_survey.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_emp')
    def test_access_answers_employee(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].create({'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].create({'question_id': self.question_num.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': self.answer_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).write({'state': 'done'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.answer_0_0.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_portal')
    def test_access_answers_portal(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].create({'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].create({'question_id': self.question_num.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': self.answer_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).write({'state': 'done'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.answer_0_0.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('user_public')
    def test_access_answers_public(self):
        # Create: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].create({'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].create({'question_id': self.question_num.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': self.answer_0.id})

        # Read: nope
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].search([('survey_id', 'in', [self.survey.id])])
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        # Write: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).write({'state': 'done'})

        # Unlink: nope
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.answer_0_0.with_user(self.env.user).unlink()

    @mute_logger('cashapp.addons.base.models.ir_model')
    @users('survey_user')
    def test_access_answers_survey_user(self):
        survey_own = self.env['survey.survey'].create({'title': 'Other'})
        self.env['survey.question'].create({'title': 'Other', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': survey_own.id})
        question_own = self.env['survey.question'].create({'title': 'Other Question', 'sequence': 1, 'survey_id': survey_own.id})

        # Create: unrestricted survey
        answer_own = self.env['survey.user_input'].create({'survey_id': survey_own.id})
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].create({'question_id': question_own.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': answer_own.id})

        # Read: restricted to self or no one
        answers = self.env['survey.user_input'].search([('survey_id', 'in', [survey_own.id, self.survey.id])])
        self.assertEqual(answers, answer_own | self.answer_0)

        answer_lines = self.env['survey.user_input.line'].search([('survey_id', 'in', [survey_own.id, self.survey.id])])
        self.assertEqual(answer_lines, self.answer_0_0 | self.answer_0_1)

        self.env['survey.user_input'].browse(answer_own.ids).read(['state'])
        self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])
        self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        self.survey.write({'restrict_user_ids': [[4, self.survey.user_id.id]]})
        with self.assertRaises(AccessError):
            self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])
        with self.assertRaises(AccessError):
            self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        # Create: in restricted users survey (moved after read because DB not correctly rollbacked with assertRaises)
        self.survey.write({'restrict_user_ids': [[4, self.survey.user_id.id]]})
        with self.assertRaises(AccessError):
            answer_other = self.env['survey.user_input'].create({'survey_id': self.survey.id})
        with self.assertRaises(AccessError):
            answer_line_other = self.env['survey.user_input.line'].create({'question_id': self.question_num.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': self.answer_0.id})

        # Write: unrestricted survey or in restricted users
        answer_own.write({'state': 'done'})
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).write({'state': 'done'})

        # Unlink: unrestricted survey or in restricted users
        answer_own.unlink()
        with self.assertRaises(AccessError):
            self.answer_0.with_user(self.env.user).unlink()
        with self.assertRaises(AccessError):
            self.answer_0_0.with_user(self.env.user).unlink()

    @users('survey_manager')
    def test_access_answers_survey_manager(self):
        admin = self.env.ref('base.user_admin')
        with self.with_user(admin.login):
            survey_other = self.env['survey.survey'].create({'title': 'Other'})
            self.env['survey.question'].create({'title': 'Other', 'sequence': 0, 'is_page': True, 'question_type': False, 'survey_id': survey_other.id})
            question_other = self.env['survey.question'].create({'title': 'Other Question', 'sequence': 1, 'survey_id': survey_other.id})
            self.assertEqual(survey_other.create_uid, admin)
            self.assertEqual(question_other.create_uid, admin)

        # Create: always
        answer_own = self.env['survey.user_input'].create({'survey_id': self.survey.id})
        answer_other = self.env['survey.user_input'].create({'survey_id': survey_other.id})
        answer_line_own = self.env['survey.user_input.line'].create({'question_id': self.question_num.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': answer_own.id})
        answer_line_other = self.env['survey.user_input.line'].create({'question_id': question_other.id, 'answer_type': 'numerical_box', 'value_numerical_box': 3, 'user_input_id': answer_other.id})

        # Read: always
        answers = self.env['survey.user_input'].search([('survey_id', 'in', [survey_other.id, self.survey.id])])
        self.assertEqual(answers, answer_own | answer_other | self.answer_0)

        answer_lines = self.env['survey.user_input.line'].search([('survey_id', 'in', [survey_other.id, self.survey.id])])
        self.assertEqual(answer_lines, answer_line_own | answer_line_other | self.answer_0_0 | self.answer_0_1)

        self.env['survey.user_input'].browse(answer_own.ids).read(['state'])
        self.env['survey.user_input'].browse(self.answer_0.ids).read(['state'])

        self.env['survey.user_input.line'].browse(answer_line_own.ids).read(['value_numerical_box'])
        self.env['survey.user_input.line'].browse(self.answer_0_0.ids).read(['value_numerical_box'])

        # Write: always
        answer_own.write({'state': 'done'})
        answer_other.write({'partner_id': self.env.user.partner_id.id})

        # Unlink: always
        (answer_own | answer_other | self.answer_0).unlink()


@tagged('post_install', '-at_install')
class TestSurveySecurityControllers(common.TestSurveyCommon, HttpCase):
    def test_survey_start_short(self):
        # avoid name clash with existing data
        surveys = self.env['survey.survey'].search([
            ('session_state', 'in', ['ready', 'in_progress'])
        ])
        self.survey.write({
            'session_state': 'ready',
            'session_code': '123456',
            'session_start_time': datetime.datetime.now(),
            'access_mode': 'public',
            'users_login_required': False,
        })

        # right short access token
        response = self.url_open('/s/123456')
        self.assertEqual(response.status_code, 200)
        self.assertIn('The session will begin automatically when the host starts', response.text)

        # `like` operator injection
        response = self.url_open('/s/______')
        self.assertFalse(self.survey.title in response.text)

        # right short token, but closed survey
        self.survey.action_archive()
        response = self.url_open('/s/123456')
        self.assertFalse(self.survey.title in response.text)

        # right short token, but wrong `session_state`
        self.survey.write({'session_state': False, 'active': True})
        response = self.url_open('/s/123456')
        self.assertFalse(self.survey.title in response.text)
