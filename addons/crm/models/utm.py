# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import fields, models


class UtmCampaign(models.Model):
    _inherit = 'utm.campaign'

    use_leads = fields.Boolean('Use Leads', compute='_compute_use_leads')
    crm_lead_count = fields.Integer('Leads/Opportunities count', groups='sales_team.group_sale_salesman', compute="_compute_crm_lead_count")

    def _compute_use_leads(self):
        self.use_leads = self.env.user.has_group('crm.group_use_lead')

    def _compute_crm_lead_count(self):
        lead_data = self.env['crm.lead'].with_context(active_test=False)._read_group([
            ('campaign_id', 'in', self.ids)],
            ['campaign_id'], ['__count'])
        mapped_data = {campaign.id: count for campaign, count in lead_data}
        for campaign in self:
            campaign.crm_lead_count = mapped_data.get(campaign.id, 0)

    def action_redirect_to_leads_opportunities(self):
        view = 'crm.crm_lead_all_leads' if self.use_leads else 'crm.crm_lead_opportunities'
        action = self.env['ir.actions.act_window']._for_xml_id(view)
        action['view_mode'] = 'list,kanban,graph,pivot,form,calendar'
        action['domain'] = [('campaign_id', 'in', self.ids)]
        action['context'] = {'active_test': False, 'create': False}
        return action
