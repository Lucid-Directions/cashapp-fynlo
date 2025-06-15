import secrets
import hashlib
from datetime import datetime, timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError, AccessError


class PosApiKey(models.Model):
    _name = 'pos.api.key'
    _description = 'POS API Key Management'
    _order = 'create_date desc'
    _rec_name = 'name'

    name = fields.Char(
        string='Key Name',
        required=True,
        help="Descriptive name for the API key"
    )
    
    key = fields.Char(
        string='API Key',
        readonly=True,
        help="The actual API key (hashed for security)"
    )
    
    key_prefix = fields.Char(
        string='Key Prefix',
        readonly=True,
        help="First 8 characters of the key for identification"
    )
    
    user_id = fields.Many2one(
        'res.users',
        string='User',
        required=True,
        default=lambda self: self.env.user,
        help="User who owns this API key"
    )
    
    active = fields.Boolean(
        string='Active',
        default=True,
        help="Whether this API key is active"
    )
    
    expires_at = fields.Datetime(
        string='Expires At',
        help="When this API key expires (optional)"
    )
    
    last_used_at = fields.Datetime(
        string='Last Used',
        readonly=True,
        help="When this API key was last used"
    )
    
    usage_count = fields.Integer(
        string='Usage Count',
        readonly=True,
        default=0,
        help="Number of times this key has been used"
    )
    
    device_id = fields.Char(
        string='Device ID',
        help="Device identifier for mobile apps"
    )
    
    permissions = fields.Text(
        string='Permissions',
        help="JSON array of permissions for this key"
    )
    
    rate_limit = fields.Integer(
        string='Rate Limit',
        default=100,
        help="Requests per minute allowed for this key"
    )
    
    notes = fields.Text(
        string='Notes',
        help="Additional notes about this API key"
    )

    @api.model
    def create(self, vals):
        """Generate API key on creation"""
        if 'key' not in vals:
            # Generate a secure API key
            raw_key = secrets.token_urlsafe(32)
            # Store hashed version
            vals['key'] = self._hash_key(raw_key)
            vals['key_prefix'] = raw_key[:8]
            
            # Store the raw key temporarily for display
            record = super().create(vals)
            record._temp_raw_key = raw_key
            return record
        
        return super().create(vals)
    
    def write(self, vals):
        """Prevent key modification"""
        if 'key' in vals or 'key_prefix' in vals:
            raise ValidationError(_("API key cannot be modified after creation"))
        return super().write(vals)
    
    def regenerate_key(self):
        """Regenerate API key"""
        self.ensure_one()
        if not self.env.user.has_group('point_of_sale_api.group_pos_api_manager'):
            raise AccessError(_("Only API managers can regenerate keys"))
        
        raw_key = secrets.token_urlsafe(32)
        self.write({
            'key': self._hash_key(raw_key),
            'key_prefix': raw_key[:8],
            'usage_count': 0,
            'last_used_at': False
        })
        self._temp_raw_key = raw_key
        return raw_key
    
    def deactivate(self):
        """Deactivate API key"""
        self.write({'active': False})
    
    def activate(self):
        """Activate API key"""
        self.write({'active': True})
    
    @api.model
    def validate_key(self, raw_key):
        """
        Validate API key and return associated user
        
        Args:
            raw_key (str): Raw API key
            
        Returns:
            tuple: (valid, user, api_key_record)
        """
        hashed_key = self._hash_key(raw_key)
        
        api_key = self.search([
            ('key', '=', hashed_key),
            ('active', '=', True)
        ], limit=1)
        
        if not api_key:
            return False, None, None
        
        # Check expiration
        if api_key.expires_at and api_key.expires_at < fields.Datetime.now():
            return False, None, api_key
        
        # Update usage statistics
        api_key.write({
            'last_used_at': fields.Datetime.now(),
            'usage_count': api_key.usage_count + 1
        })
        
        return True, api_key.user_id, api_key
    
    @staticmethod
    def _hash_key(raw_key):
        """Hash API key for secure storage"""
        return hashlib.sha256(raw_key.encode()).hexdigest()
    
    def get_display_key(self):
        """Get display version of API key (for UI)"""
        if hasattr(self, '_temp_raw_key'):
            return self._temp_raw_key
        return f"{self.key_prefix}..." if self.key_prefix else "****" 