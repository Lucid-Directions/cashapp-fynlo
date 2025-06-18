# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from . import models
# TODO: Create these directories and modules to complete functionality
# from . import wizard
# from . import controllers

def post_init_hook(cr, registry):
    """Initialize POS Cash Restaurant module after installation"""
    from cashapp import api, SUPERUSER_ID
    
    env = api.Environment(cr, SUPERUSER_ID, {})
    
    # Setup UK-specific configurations
    _setup_uk_configurations(env)
    
    # Setup default payment methods
    _setup_payment_methods(env)
    
    # Setup demo restaurant if requested
    _setup_demo_restaurant(env)

def _setup_uk_configurations(env):
    """Setup UK-specific tax rates and configurations"""
    # Configure UK VAT rates
    company = env.company
    if company.country_id.code == 'GB':
        # Standard VAT rate (20%)
        standard_vat = env['account.tax'].search([
            ('name', '=', 'VAT 20%'),
            ('company_id', '=', company.id)
        ], limit=1)
        
        if not standard_vat:
            env['account.tax'].create({
                'name': 'VAT 20%',
                'amount': 20.0,
                'amount_type': 'percent',
                'type_tax_use': 'sale',
                'company_id': company.id,
                'description': 'UK Standard VAT Rate',
            })
        
        # Reduced VAT rate for food (5%)
        food_vat = env['account.tax'].search([
            ('name', '=', 'VAT 5% (Food)'),
            ('company_id', '=', company.id)
        ], limit=1)
        
        if not food_vat:
            env['account.tax'].create({
                'name': 'VAT 5% (Food)',
                'amount': 5.0,
                'amount_type': 'percent',
                'type_tax_use': 'sale',
                'company_id': company.id,
                'description': 'UK Reduced VAT Rate for Food',
            })

def _setup_payment_methods(env):
    """Setup default payment methods for POS Cash"""
    pos_configs = env['pos.config'].search([])
    
    # Create Stripe payment method
    stripe_journal = env['account.journal'].search([
        ('name', '=', 'Stripe'),
        ('type', '=', 'bank')
    ], limit=1)
    
    if not stripe_journal:
        stripe_journal = env['account.journal'].create({
            'name': 'Stripe',
            'type': 'bank',
            'code': 'STRIPE',
            'currency_id': env.ref('base.GBP').id,
        })
    
    # Create PayPal payment method
    paypal_journal = env['account.journal'].search([
        ('name', '=', 'PayPal'),
        ('type', '=', 'bank')
    ], limit=1)
    
    if not paypal_journal:
        paypal_journal = env['account.journal'].create({
            'name': 'PayPal',
            'type': 'bank',
            'code': 'PAYPAL',
            'currency_id': env.ref('base.GBP').id,
        })

def _setup_demo_restaurant(env):
    """Setup demo restaurant data if in demo mode"""
    # TODO: This function references restaurant.floor and restaurant.table models
    # which don't exist yet. Comment out until models are created.
    
    # if env.registry.in_test_mode():
    #     # Create demo restaurant floor plan
    #     demo_floor = env['restaurant.floor'].create({
    #         'name': 'Main Dining Area',
    #         'sequence': 1,
    #     })
    #     
    #     # Create demo tables
    #     for i in range(1, 21):  # Tables 1-20
    #         env['restaurant.table'].create({
    #             'name': f'Table {i}',
    #             'floor_id': demo_floor.id,
    #             'seats': 4 if i <= 15 else 2,  # Most tables seat 4, some seat 2
    #             'position_h': (i % 5) * 100,
    #             'position_v': (i // 5) * 100,
    #         })
    pass 