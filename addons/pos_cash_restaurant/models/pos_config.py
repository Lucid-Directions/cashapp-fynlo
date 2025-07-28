# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import models, fields, api, _
from cashapp.exceptions import UserError, ValidationError
from cashapp.addons.base.models.res_partner import _lang_get


class PosConfig(models.Model):
    _inherit = 'pos.config'

    # POS Cash Features
    pos_cash_enabled = fields.Boolean(
        string='Enable POS Cash',
        default=True,
        help="Enable POS Cash features for this point of sale configuration."
    )
    
    # Mobile-first settings
    mobile_optimized = fields.Boolean(
        string='Mobile Optimized',
        default=True,
        help="Optimize interface for mobile devices"
    )
    
    touch_friendly = fields.Boolean(
        string='Touch Friendly Interface',
        default=True,
        help="Enable touch-friendly UI elements"
    )
    
    # Hardware-free settings
    hardware_free_mode = fields.Boolean(
        string='Hardware Free Mode',
        default=True,
        help="Operate without dedicated POS hardware"
    )
    
    # UK-specific settings
    uk_vat_enabled = fields.Boolean(
        string='UK VAT Compliance',
        default=True,
        help="Enable UK VAT compliance features"
    )
    
    uk_bank_integration = fields.Boolean(
        string='UK Bank Integration',
        default=False,
        help="Enable UK banking system integration"
    )
    
    # Payment processing
    stripe_enabled = fields.Boolean(
        string='Stripe Payments',
        default=False,
        help="Enable Stripe payment processing"
    )
    
    stripe_publishable_key = fields.Char(
        string='Stripe Publishable Key',
        help="Stripe publishable key for frontend"
    )
    
    stripe_secret_key = fields.Char(
        string='Stripe Secret Key',
        help="Stripe secret key for backend processing"
    )
    
    paypal_enabled = fields.Boolean(
        string='PayPal Payments',
        default=False,
        help="Enable PayPal payment processing"
    )
    
    paypal_client_id = fields.Char(
        string='PayPal Client ID',
        help="PayPal client ID for payment processing"
    )
    
    paypal_client_secret = fields.Char(
        string='PayPal Client Secret',
        help="PayPal client secret for payment processing"
    )
    
    # Contactless payments
    apple_pay_enabled = fields.Boolean(
        string='Apple Pay',
        default=False,
        help="Enable Apple Pay payments"
    )
    
    google_pay_enabled = fields.Boolean(
        string='Google Pay',
        default=False,
        help="Enable Google Pay payments"
    )
    
    contactless_enabled = fields.Boolean(
        string='Contactless Cards',
        default=False,
        help="Enable contactless card payments via NFC"
    )
    
    # Restaurant features
    table_management = fields.Boolean(
        string='Table Management',
        default=True,
        help="Enable table management for restaurant service"
    )
    
    kitchen_display = fields.Boolean(
        string='Kitchen Display',
        default=True,
        help="Enable kitchen display integration"
    )
    
    online_ordering = fields.Boolean(
        string='Online Ordering',
        default=False,
        help="Enable online ordering system"
    )
    
    qr_menu = fields.Boolean(
        string='QR Code Menu',
        default=False,
        help="Enable QR code menu for customers"
    )
    
    # Customer features
    customer_display = fields.Boolean(
        string='Customer Display',
        default=False,
        help="Enable customer-facing display"
    )
    
    loyalty_program = fields.Boolean(
        string='Loyalty Program',
        default=False,
        help="Enable customer loyalty program"
    )
    
    # Analytics and reporting
    advanced_analytics = fields.Boolean(
        string='Advanced Analytics',
        default=True,
        help="Enable advanced analytics and reporting"
    )
    
    real_time_reporting = fields.Boolean(
        string='Real-time Reporting',
        default=True,
        help="Enable real-time sales reporting"
    )
    
    # Delivery integration
    delivery_integration = fields.Boolean(
        string='Delivery Integration',
        default=False,
        help="Enable third-party delivery service integration"
    )
    
    uber_eats_enabled = fields.Boolean(
        string='Uber Eats',
        default=False,
        help="Enable Uber Eats integration"
    )
    
    deliveroo_enabled = fields.Boolean(
        string='Deliveroo',
        default=False,
        help="Enable Deliveroo integration"
    )
    
    just_eat_enabled = fields.Boolean(
        string='Just Eat',
        default=False,
        help="Enable Just Eat integration"
    )
    
    @api.constrains('stripe_enabled', 'stripe_publishable_key', 'stripe_secret_key')
    def _check_stripe_config(self):
        for config in self:
            if config.stripe_enabled:
                if not config.stripe_publishable_key or not config.stripe_secret_key:
                    raise ValidationError(_("Stripe keys are required when Stripe is enabled."))
    
    @api.constrains('paypal_enabled', 'paypal_client_id', 'paypal_client_secret')
    def _check_paypal_config(self):
        for config in self:
            if config.paypal_enabled:
                if not config.paypal_client_id or not config.paypal_client_secret:
                    raise ValidationError(_("PayPal credentials are required when PayPal is enabled."))
    
    @api.model
    def create(self, vals):
        """Create POS config with POS Cash defaults"""
        if vals.get('pos_cash_enabled', True):
            # Set POS Cash defaults
            vals.setdefault('mobile_optimized', True)
            vals.setdefault('touch_friendly', True)
            vals.setdefault('hardware_free_mode', True)
            vals.setdefault('uk_vat_enabled', True)
            vals.setdefault('table_management', True)
            vals.setdefault('kitchen_display', True)
            vals.setdefault('advanced_analytics', True)
            vals.setdefault('real_time_reporting', True)
        
        return super(PosConfig, self).create(vals)
    
    def get_stripe_config(self):
        """Get Stripe configuration for frontend"""
        self.ensure_one()
        if not self.stripe_enabled:
            raise UserError(_("Stripe is not enabled for this POS configuration."))
        
        return {
            'publishable_key': self.stripe_publishable_key,
            'enabled': self.stripe_enabled,
            'apple_pay': self.apple_pay_enabled,
            'google_pay': self.google_pay_enabled,
        }
    
    def get_paypal_config(self):
        """Get PayPal configuration for frontend"""
        self.ensure_one()
        if not self.paypal_enabled:
            raise UserError(_("PayPal is not enabled for this POS configuration."))
        
        return {
            'client_id': self.paypal_client_id,
            'enabled': self.paypal_enabled,
        }
    
    def get_mobile_config(self):
        """Get mobile-specific configuration"""
        self.ensure_one()
        return {
            'mobile_optimized': self.mobile_optimized,
            'touch_friendly': self.touch_friendly,
            'hardware_free_mode': self.hardware_free_mode,
            'contactless_enabled': self.contactless_enabled,
            'apple_pay_enabled': self.apple_pay_enabled,
            'google_pay_enabled': self.google_pay_enabled,
        }
    
    def get_restaurant_config(self):
        """Get restaurant-specific configuration"""
        self.ensure_one()
        return {
            'table_management': self.table_management,
            'kitchen_display': self.kitchen_display,
            'online_ordering': self.online_ordering,
            'qr_menu': self.qr_menu,
            'loyalty_program': self.loyalty_program,
        }
    
    def get_delivery_config(self):
        """Get delivery integration configuration"""
        self.ensure_one()
        return {
            'delivery_integration': self.delivery_integration,
            'uber_eats_enabled': self.uber_eats_enabled,
            'deliveroo_enabled': self.deliveroo_enabled,
            'just_eat_enabled': self.just_eat_enabled,
        } 