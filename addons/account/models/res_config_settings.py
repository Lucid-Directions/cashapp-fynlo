# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import _, api, fields, models
from cashapp.addons.account.models.company import PEPPOL_LIST


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    has_accounting_entries = fields.Boolean(compute='_compute_has_chart_of_accounts')
    currency_id = fields.Many2one('res.currency', related="company_id.currency_id", required=True, readonly=False,
        string='Currency', help="Main currency of the company.")
    currency_exchange_journal_id = fields.Many2one(
        comodel_name='account.journal',
        related='company_id.currency_exchange_journal_id', readonly=False,
        string="Currency Exchange Journal",
        check_company=True,
        domain="[('type', '=', 'general')]",
        help='The accounting journal where automatic exchange differences will be registered')
    income_currency_exchange_account_id = fields.Many2one(
        comodel_name="account.account",
        related="company_id.income_currency_exchange_account_id",
        string="Gain Exchange Rate Account",
        readonly=False,
        check_company=True,
        domain="[('deprecated', '=', False), ('internal_group', '=', 'income')]")
    expense_currency_exchange_account_id = fields.Many2one(
        comodel_name="account.account",
        related="company_id.expense_currency_exchange_account_id",
        string="Loss Exchange Rate Account",
        readonly=False,
        check_company=True,
        domain="[('deprecated', '=', False), ('account_type', '=', 'expense')]")
    has_chart_of_accounts = fields.Boolean(compute='_compute_has_chart_of_accounts', string='Company has a chart of accounts')
    chart_template = fields.Selection(selection=lambda self: self.env.company._chart_template_selection(), default=lambda self: self.env.company.chart_template)
    sale_tax_id = fields.Many2one(
        'account.tax',
        string="Default Sale Tax",
        related='company_id.account_sale_tax_id',
        readonly=False,
        check_company=True,
    )
    purchase_tax_id = fields.Many2one(
        'account.tax',
        string="Default Purchase Tax",
        related='company_id.account_purchase_tax_id',
        readonly=False,
        check_company=True,
    )
    account_price_include = fields.Selection(
        string='Default Sales Price Include',
        related='company_id.account_price_include',
        readonly=False,
        required=True,
        help="Default on whether the sales price used on the product and invoices with this Company includes its taxes."
    )

    tax_calculation_rounding_method = fields.Selection(
        related='company_id.tax_calculation_rounding_method', string='Tax calculation rounding method', readonly=False)
    account_journal_suspense_account_id = fields.Many2one(
        comodel_name='account.account',
        string='Bank Suspense',
        readonly=False,
        related='company_id.account_journal_suspense_account_id',
        check_company=True,
        domain="[('deprecated', '=', False), ('account_type', 'in', ('asset_current', 'liability_current'))]",
        help='Bank Transactions are posted immediately after import or synchronization. '
             'Their counterparty is the bank suspense account.\n'
             'Reconciliation replaces the latter by the definitive account(s).')
    transfer_account_id = fields.Many2one('account.account', string="Internal Transfer",
        related='company_id.transfer_account_id', readonly=False,
        check_company=True,
        domain=[
            ('reconcile', '=', True),
            ('account_type', '=', 'asset_current'),
            ('deprecated', '=', False),
        ],
        help="Intermediary account used when moving from a liquidity account to another.")
    module_account_accountant = fields.Boolean(string='Accounting')
    group_warning_account = fields.Boolean(string="Warnings in Invoices", implied_group='account.group_warning_account')
    group_cash_rounding = fields.Boolean(string="Cash Rounding", implied_group='account.group_cash_rounding')
    group_show_sale_receipts = fields.Boolean(string='Sale Receipt',
        implied_group='account.group_sale_receipts')
    group_show_purchase_receipts = fields.Boolean(string='Purchase Receipt',
        implied_group='account.group_purchase_receipts')
    module_account_budget = fields.Boolean(string='Budget Management')
    module_account_payment = fields.Boolean(string='Invoice Online Payment')
    module_account_reports = fields.Boolean("Dynamic Reports")
    module_account_check_printing = fields.Boolean("Allow check printing and deposits")
    module_account_batch_payment = fields.Boolean(string='Use batch payments',
        help='This allows you grouping payments into a single batch and eases the reconciliation process.\n'
             '-This installs the account_batch_payment module.')
    module_account_iso20022 = fields.Boolean(string='SEPA Credit Transfer / ISO20022')
    module_account_sepa_direct_debit = fields.Boolean(string='Use SEPA Direct Debit')
    module_account_bank_statement_import_qif = fields.Boolean("Import .qif files")
    module_account_bank_statement_import_ofx = fields.Boolean("Import in .ofx format")
    module_account_bank_statement_import_csv = fields.Boolean("Import in .csv, .xls, and .xlsx format")
    module_account_bank_statement_import_camt = fields.Boolean("Import in CAMT.053 format")
    module_currency_rate_live = fields.Boolean(string="Automatic Currency Rates")
    module_account_intrastat = fields.Boolean(string='Intrastat')
    module_product_margin = fields.Boolean(string="Allow Product Margin")
    module_l10n_eu_oss = fields.Boolean(string="EU Intra-community Distance Selling")
    module_account_extract = fields.Boolean(string="Document Digitization")
    module_account_invoice_extract = fields.Boolean("Invoice Digitization", compute='_compute_module_account_invoice_extract', readonly=False, store=True)
    module_account_bank_statement_extract = fields.Boolean("Bank Statement Digitization", compute='_compute_module_account_bank_statement_extract', readonly=False, store=True)
    module_snailmail_account = fields.Boolean(string="Snailmail")
    module_account_peppol = fields.Boolean(string='PEPPOL Invoicing')
    tax_exigibility = fields.Boolean(string='Cash Basis', related='company_id.tax_exigibility', readonly=False)
    tax_cash_basis_journal_id = fields.Many2one(
        'account.journal',
        string="Tax Cash Basis Journal",
        related='company_id.tax_cash_basis_journal_id',
        readonly=False,
        check_company=True,
    )
    account_cash_basis_base_account_id = fields.Many2one(
        comodel_name='account.account',
        string="Base Tax Received Account",
        readonly=False,
        check_company=True,
        related='company_id.account_cash_basis_base_account_id',
        domain=[('deprecated', '=', False)])
    account_fiscal_country_id = fields.Many2one(string="Fiscal Country Code", related="company_id.account_fiscal_country_id", readonly=False, store=False)

    qr_code = fields.Boolean(string='Display SEPA QR-code', related='company_id.qr_code', readonly=False)
    incoterm_id = fields.Many2one('account.incoterms', string='Default incoterm', related='company_id.incoterm_id', help='International Commercial Terms are a series of predefined commercial terms used in international transactions.', readonly=False)
    invoice_terms = fields.Html(related='company_id.invoice_terms', string="Terms & Conditions", readonly=False)
    invoice_terms_html = fields.Html(related='company_id.invoice_terms_html', string="Terms & Conditions as a Web page",
                                     readonly=False)
    terms_type = fields.Selection(
        related='company_id.terms_type', readonly=False)
    display_invoice_amount_total_words = fields.Boolean(
        string="Total amount of invoice in letters",
        related='company_id.display_invoice_amount_total_words',
        readonly=False
    )
    display_invoice_tax_company_currency = fields.Boolean(
        string="Taxes in company currency",
        related='company_id.display_invoice_tax_company_currency',
        readonly=False,
    )
    preview_ready = fields.Boolean(string="Display preview button", compute='_compute_terms_preview')

    use_invoice_terms = fields.Boolean(
        string='Default Terms & Conditions',
        config_parameter='account.use_invoice_terms')
    account_use_credit_limit = fields.Boolean(
        string="Sales Credit Limit", related="company_id.account_use_credit_limit", readonly=False,
        help="Enable the use of credit limit on partners.")
    account_default_credit_limit = fields.Monetary(
        string="Default Credit Limit", readonly=False,
        help='This is the default credit limit that will be used on partners that do not have a specific limit on them.',
        compute="_compute_account_default_credit_limit", inverse="_inverse_account_default_credit_limit")

    # Technical field to hide country specific fields from accounting configuration
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code', readonly=True)

    # Storno Accounting
    account_storno = fields.Boolean(string="Storno accounting", readonly=False, related='company_id.account_storno')

    # Allows for the use of a different delivery address
    group_sale_delivery_address = fields.Boolean("Customer Addresses", implied_group='account.group_delivery_invoice_address')

    # Quick encoding (fiduciary mode)
    quick_edit_mode = fields.Selection(string="Quick encoding", readonly=False, related='company_id.quick_edit_mode')

    account_journal_early_pay_discount_loss_account_id = fields.Many2one(
        comodel_name='account.account',
        string='Early Discount Loss',
        help='Account for the difference amount after the expense discount has been granted',
        readonly=False,
        related='company_id.account_journal_early_pay_discount_loss_account_id',
        check_company=True,
        domain="[('deprecated', '=', False), ('account_type', 'in', ('expense', 'income', 'income_other'))]",
    )
    account_journal_early_pay_discount_gain_account_id = fields.Many2one(
        comodel_name='account.account',
        string='Early Discount Gain',
        help='Account for the difference amount after the income discount has been granted',
        readonly=False,
        check_company=True,
        related='company_id.account_journal_early_pay_discount_gain_account_id',
        domain="[('deprecated', '=', False), ('account_type', 'in', ('income', 'income_other', 'expense'))]",
    )

    # Accounts for allocation of discounts
    account_discount_income_allocation_id = fields.Many2one(
        comodel_name='account.account',
        string='Vendor Bills Discounts Account',
        readonly=False,
        related='company_id.account_discount_income_allocation_id',
        domain="[('account_type', 'in', ('income', 'expense'))]",
    )
    account_discount_expense_allocation_id = fields.Many2one(
        comodel_name='account.account',
        string='Customer Invoices Discounts Account',
        readonly=False,
        related='company_id.account_discount_expense_allocation_id',
        domain="[('account_type', 'in', ('income', 'expense'))]",
    )

    # PEPPOL
    is_account_peppol_eligible = fields.Boolean(
        string='PEPPOL eligible',
        compute='_compute_is_account_peppol_eligible',
    ) # technical field used for showing the Peppol settings conditionally

    # Audit trail
    check_account_audit_trail = fields.Boolean(string='Audit Trail', related='company_id.check_account_audit_trail', readonly=False)

    # Autopost of bills
    autopost_bills = fields.Boolean(related='company_id.autopost_bills', readonly=False)

    @api.depends('country_code')
    def _compute_is_account_peppol_eligible(self):
        # we want to show Peppol settings only to customers that are eligible for Peppol,
        # except countries that are not in Europe
        for config in self:
            config.is_account_peppol_eligible = config.country_code in PEPPOL_LIST

    def set_values(self):
        super().set_values()
        # install a chart of accounts for the given company (if required)
        if self.env.company == self.company_id and self.chart_template \
        and self.chart_template != self.company_id.chart_template:
            self.env['account.chart.template'].try_loading(self.chart_template, company=self.company_id)

    def reload_template(self):
        self.env['account.chart.template'].try_loading(self.company_id.chart_template, company=self.company_id)

    @api.depends('company_id')
    def _compute_account_default_credit_limit(self):
        ResPartner = self.env['res.partner']
        company_limit = ResPartner._fields['credit_limit'].get_company_dependent_fallback(ResPartner)
        self.account_default_credit_limit = company_limit

    def _inverse_account_default_credit_limit(self):
        for setting in self:
            self.env['ir.default'].set(
                'res.partner',
                'credit_limit',
                setting.account_default_credit_limit,
                company_id=setting.company_id.id
            )

    @api.depends('company_id')
    def _compute_has_chart_of_accounts(self):
        self.has_chart_of_accounts = bool(self.company_id.chart_template)
        self.has_accounting_entries = self.company_id.root_id._existing_accounting()

    @api.depends('module_account_extract')
    def _compute_module_account_invoice_extract(self):
        for config in self:
            config.module_account_invoice_extract = config.module_account_extract and self.env['ir.module.module']._get('account_invoice_extract').state == 'installed'

    @api.depends('module_account_extract')
    def _compute_module_account_bank_statement_extract(self):
        for config in self:
            config.module_account_bank_statement_extract = config.module_account_extract and self.env['ir.module.module']._get('account_invoice_extract').state == 'installed'

    @api.onchange('group_analytic_accounting')
    def onchange_analytic_accounting(self):
        if self.group_analytic_accounting:
            self.module_account_accountant = True

    @api.onchange('module_account_budget')
    def onchange_module_account_budget(self):
        if self.module_account_budget:
            self.group_analytic_accounting = True

    @api.onchange('tax_exigibility')
    def _onchange_tax_exigibility(self):
        res = {}
        tax = self.env['account.tax'].search([
            *self.env['account.tax']._check_company_domain(self.env.company),
            ('tax_exigibility', '=', 'on_payment'),
        ], limit=1)
        if not self.tax_exigibility and tax:
            self.tax_exigibility = True
            res['warning'] = {
                'title': _('Error!'),
                'message': _('You cannot disable this setting because some of your taxes are cash basis. '
                             'Modify your taxes first before disabling this setting.')
            }
        return res

    @api.depends('terms_type')
    def _compute_terms_preview(self):
        for setting in self:
            # We display the preview button only if the terms_type is html in the setting but also on the company
            # to avoid landing on an error page (see terms.py controller)
            setting.preview_ready = self.env.company.terms_type == 'html' and setting.terms_type == 'html'

    def action_update_terms(self):
        self.ensure_one()
        if hasattr(self, 'website_id') and self.env.user.has_group('website.group_website_designer'):
            return self.env["website"].get_client_action('/terms', True)
        return {
            'name': _('Update Terms & Conditions'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'res.company',
            'view_id': self.env.ref("account.res_company_view_form_terms", False).id,
            'target': 'new',
            'res_id': self.company_id.id,
        }
