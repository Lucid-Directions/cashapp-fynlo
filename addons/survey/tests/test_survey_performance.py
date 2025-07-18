# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp.addons.survey.tests import common
from cashapp.tests import tagged
from cashapp.tests.common import warmup, HttpCase


@tagged('post_install', '-at_install')
class SurveyPerformance(common.TestSurveyResultsCommon, HttpCase):

    @warmup
    def test_survey_results_with_multiple_filters_mixed_model(self):
        """ Check that, in comparison with having filters from the same model,
        having filters from different models needs only a few more queries.
        """
        url = f'/survey/results/{self.survey.id}?filters=A,0,{self.gras_id}|L,0,{self.answer_pauline.id}'
        self.authenticate('survey_manager', 'survey_manager')
        # cold orm/fields cache (only survey: 26, all module: 23)
        #  the extra requests are `_get_default_lang` which is not called when website is installed
        with self.assertQueryCount(default=26):
            self.url_open(url)

    @warmup
    def test_survey_results_with_multiple_filters_question_answer_model(self):
        """ Check that no matter the number of filters, if their answers
        data are stored in the same model (here survey.question.answer)
        the query count stay the same as having a single filter.
        """
        url = f'/survey/results/{self.survey.id}?filters=A,0,{self.gras_id}|A,0,{self.cat_id}'
        self.authenticate('survey_manager', 'survey_manager')
        # cold orm/fields cache (only survey: 24, all module: 21)
        #  the extra requests are `_get_default_lang` which is not called when website is installed
        with self.assertQueryCount(default=24):
            self.url_open(url)

    @warmup
    def test_survey_results_with_one_filter(self):
        url = f'/survey/results/{self.survey.id}?filters=A,0,{self.cat_id}'
        self.authenticate('survey_manager', 'survey_manager')
        # cold orm/fields cache (only survey: 24, all module: 21)
        #  the extra requests are `_get_default_lang` which is not called when website is installed
        with self.assertQueryCount(default=24):
            self.url_open(url)
