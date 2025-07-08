# SendGrid to Resend Migration Guide

**Fynlo POS Email Service Migration**  
**Date**: January 2025  
**Target**: Replace SendGrid with Resend for email delivery  
**Benefit**: DigitalOcean partnership integration + cost optimization  

## Overview

This guide provides step-by-step instructions to migrate from SendGrid to Resend email service while maintaining all existing functionality and email templates.

### Current SendGrid Usage
- **Primary Use**: Refund receipt emails (`send_receipt()` method)
- **Template**: HTML receipt template with order details
- **Integration**: Clean abstraction layer in `EmailService` class
- **Dependencies**: `sendgrid==6.11.0`, `sendgrid.helpers.mail`

### Migration Benefits
- **Cost**: More competitive pricing than SendGrid
- **Integration**: DigitalOcean recommended partner
- **API**: Simpler, more modern API design
- **Performance**: Faster delivery times
- **Reliability**: 99.9% uptime SLA

---

## Step 1: Install Resend Dependencies

### 1.1 Update Requirements Files

**Update `backend/requirements.txt`:**
```bash
# Remove SendGrid
# sendgrid==6.11.0

# Add Resend
resend==0.7.0
```

**Update `backend/requirements-dev.txt`:**
```bash
# Development testing remains the same - Resend uses same testing patterns
```

### 1.2 Install Dependencies Locally
```bash
cd backend/
pip install resend==0.7.0
pip uninstall sendgrid
```

---

## Step 2: Environment Configuration

### 2.1 Update Environment Variables

**Add to `.env.development`:**
```env
# Replace SendGrid configuration
# SENDGRID_API_KEY=your_sendgrid_key
# SENDGRID_FROM_EMAIL=noreply@fynlopos.com

# Add Resend configuration
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@fynlopos.com
RESEND_FROM_NAME=Fynlo POS
```

**Add to `.env.production`:**
```env
# Production Resend configuration
RESEND_API_KEY=re_your_production_resend_api_key
RESEND_FROM_EMAIL=noreply@fynlopos.com
RESEND_FROM_NAME=Fynlo POS
```

### 2.2 Update DigitalOcean Environment Variables

In DigitalOcean App Platform dashboard:
1. Go to Settings → Environment Variables
2. Remove: `SENDGRID_API_KEY`
3. Add: `RESEND_API_KEY` = `re_your_production_key`
4. Add: `RESEND_FROM_EMAIL` = `noreply@fynlopos.com`
5. Add: `RESEND_FROM_NAME` = `Fynlo POS`

### 2.3 Update Backend Configuration

**Update `backend/app/core/config.py`:**
```python
class Settings(BaseSettings):
    # Remove SendGrid settings
    # SENDGRID_API_KEY: Optional[str] = None
    # SENDGRID_FROM_EMAIL: Optional[str] = None
    
    # Add Resend settings
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "noreply@fynlopos.com"
    RESEND_FROM_NAME: str = "Fynlo POS"
```

---

## Step 3: Update EmailService Implementation

### 3.1 Backup Current EmailService
```bash
cp backend/app/services/email_service.py backend/app/services/email_service_sendgrid_backup.py
```

### 3.2 Create New Resend EmailService

**Replace `backend/app/services/email_service.py` content:**

```python
"""
Email Service using Resend API for Fynlo POS
Handles transactional emails including receipt delivery
"""

import os
import logging
from typing import Literal, Optional, Dict, Any
from jinja2 import Environment, FileSystemLoader
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Email service using Resend API for transactional emails"""
    
    def __init__(self):
        """Initialize Resend email service"""
        self.api_key = settings.RESEND_API_KEY
        self.from_addr = settings.RESEND_FROM_EMAIL
        self.from_name = settings.RESEND_FROM_NAME
        
        if not self.api_key:
            logger.error("RESEND_API_KEY not configured")
            raise ValueError("RESEND_API_KEY must be set in environment variables")
        
        # Configure Resend
        resend.api_key = self.api_key
        
        # Setup Jinja2 for email templates
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates', 'email')
        self.jinja_env = Environment(loader=FileSystemLoader(template_dir))
        
        logger.info(f"EmailService initialized with Resend - From: {self.from_addr}")
    
    def send_receipt(self, order, type_: Literal["sale", "refund"], amount: float) -> bool:
        """
        Send receipt email for sale or refund
        
        Args:
            order: Order object with order details
            type_: Email type ("sale" or "refund")
            amount: Transaction amount
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Validate required data
            if not hasattr(order, 'customer_email') or not order.customer_email:
                logger.warning(f"No customer email for order {getattr(order, 'order_number', 'unknown')}")
                return False
            
            # Generate email content from template
            template = self.jinja_env.get_template('receipt.html')
            html_content = template.render(
                order=order,
                type=type_,
                amount=amount
            )
            
            # Determine email subject
            if type_ == "refund":
                subject = f"Refund Confirmation - Order #{getattr(order, 'order_number', 'N/A')}"
            else:
                subject = f"Receipt - Order #{getattr(order, 'order_number', 'N/A')}"
            
            # Send email using Resend
            params = {
                "from": f"{self.from_name} <{self.from_addr}>",
                "to": [order.customer_email],
                "subject": subject,
                "html": html_content,
                "tags": [
                    {"name": "category", "value": "receipt"},
                    {"name": "type", "value": type_},
                    {"name": "order_id", "value": str(getattr(order, 'id', 'unknown'))}
                ]
            }
            
            response = resend.Emails.send(params)
            
            # Check response
            if response and hasattr(response, 'get') and response.get('id'):
                logger.info(f"Receipt email sent successfully - ID: {response['id']}")
                return True
            else:
                logger.error(f"Failed to send receipt email - Invalid response: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending receipt email: {str(e)}")
            return False
    
    def send_custom_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send custom email with HTML content
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email content
            tags: Optional tags for email tracking
            
        Returns:
            bool: True if sent successfully, False otherwise
        """
        try:
            params = {
                "from": f"{self.from_name} <{self.from_addr}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }
            
            # Add tags if provided
            if tags:
                params["tags"] = [{"name": k, "value": v} for k, v in tags.items()]
            
            response = resend.Emails.send(params)
            
            if response and hasattr(response, 'get') and response.get('id'):
                logger.info(f"Custom email sent successfully - ID: {response['id']}")
                return True
            else:
                logger.error(f"Failed to send custom email - Invalid response: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending custom email: {str(e)}")
            return False
    
    def test_connection(self) -> bool:
        """Test Resend API connection"""
        try:
            # Send a test email to verify configuration
            response = resend.Emails.send({
                "from": f"{self.from_name} <{self.from_addr}>",
                "to": [self.from_addr],  # Send to ourselves
                "subject": "Resend Configuration Test",
                "html": "<p>This is a test email to verify Resend configuration.</p>"
            })
            
            if response and hasattr(response, 'get') and response.get('id'):
                logger.info("Resend connection test successful")
                return True
            else:
                logger.error("Resend connection test failed")
                return False
                
        except Exception as e:
            logger.error(f"Resend connection test error: {str(e)}")
            return False
```

---

## Step 4: Update Import Statements

### 4.1 Find Files Using EmailService

**Search for EmailService imports:**
```bash
cd backend/
grep -r "email_service" app/ --include="*.py"
grep -r "EmailService" app/ --include="*.py"
```

### 4.2 Update Import Statements

**Files to check and update:**
- `app/api/v1/endpoints/orders.py` ✅ (already imported correctly)
- Any other files that import `EmailService`

**Verify imports are correct:**
```python
from app.services.email_service import EmailService
```

---

## Step 5: Resend Account Setup

### 5.1 Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up with your business email
3. Verify email address
4. Complete account setup

### 5.2 Domain Configuration
1. Add your domain: `fynlopos.com`
2. Add DNS records provided by Resend:
   ```
   TXT _resend.fynlopos.com [verification-code]
   MX resend.fynlopos.com 10 mail.resend.com
   ```
3. Wait for domain verification (usually 5-10 minutes)

### 5.3 API Key Generation
1. Go to API Keys section
2. Create new API key: "Fynlo POS Production"
3. Copy the API key (starts with `re_`)
4. Store securely - you can't view it again

### 5.4 From Address Configuration
1. Go to Domains → fynlopos.com
2. Add sending address: `noreply@fynlopos.com`
3. Verify the address

---

## Step 6: Testing Migration

### 6.1 Local Testing

**Create test script `backend/test_resend.py`:**
```python
"""Test Resend email service integration"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.email_service import EmailService
from app.core.config import settings

# Mock order object for testing
class MockOrder:
    def __init__(self):
        self.customer_email = "test@example.com"  # Use your email for testing
        self.order_number = "TEST001"
        self.id = "test-order-id"
        self.subtotal = 25.50
        self.tax_amount = 5.10
        self.service_charge = 3.19
        self.total_amount = 33.79
        self.items = [
            {
                'name': 'Test Burrito',
                'quantity': 2,
                'unit_price': 12.75,
                'total_price': 25.50
            }
        ]

def test_email_service():
    """Test email service functionality"""
    try:
        # Initialize email service
        email_service = EmailService()
        
        # Test connection
        print("Testing Resend connection...")
        if email_service.test_connection():
            print("✅ Resend connection successful")
        else:
            print("❌ Resend connection failed")
            return
        
        # Test receipt email
        print("Testing receipt email...")
        mock_order = MockOrder()
        
        if email_service.send_receipt(mock_order, "refund", 33.79):
            print("✅ Receipt email sent successfully")
        else:
            print("❌ Receipt email failed")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_email_service()
```

**Run test:**
```bash
cd backend/
python test_resend.py
```

### 6.2 API Testing

**Test with curl:**
```bash
# Test Resend API directly
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_your_api_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Fynlo POS <noreply@fynlopos.com>",
    "to": ["your-email@example.com"],
    "subject": "Test Email",
    "html": "<p>Test email from Resend API</p>"
  }'
```

---

## Step 7: Deployment

### 7.1 Update Requirements in Production

**Commit changes:**
```bash
cd backend/
git add requirements.txt app/services/email_service.py app/core/config.py
git commit -m "feat: migrate from SendGrid to Resend email service

- Replace sendgrid dependency with resend==0.7.0
- Update EmailService to use Resend API
- Maintain all existing functionality and templates
- Add Resend configuration to settings
- Preserve receipt email functionality"
git push origin main
```

### 7.2 DigitalOcean Deployment

1. **Update Environment Variables** (already done in Step 2.2)
2. **Monitor Deployment:**
   ```bash
   # Watch DigitalOcean deployment logs
   # Check for successful restart
   ```

### 7.3 Verify Production Deployment

**Test production email:**
```bash
# Make API call to trigger receipt email
curl -X POST 'https://your-backend.digitalocean.app/api/v1/orders/{order_id}/refund' \
  -H 'Authorization: Bearer your_jwt_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 10.00,
    "reason": "Testing Resend migration"
  }'
```

---

## Step 8: Monitoring & Validation

### 8.1 Email Delivery Monitoring

**Resend Dashboard:**
1. Go to resend.com dashboard
2. Check "Emails" section for delivery status
3. Monitor bounce rates and delivery metrics
4. Set up webhooks for delivery tracking (optional)

### 8.2 Application Logs

**Check backend logs:**
```bash
# DigitalOcean logs
# Look for EmailService log messages:
# "EmailService initialized with Resend"
# "Receipt email sent successfully"
```

### 8.3 Error Handling

**Common issues and solutions:**

1. **API Key Invalid:**
   ```
   Error: Authentication failed
   Solution: Verify RESEND_API_KEY in environment variables
   ```

2. **Domain Not Verified:**
   ```
   Error: From address not verified
   Solution: Complete domain verification in Resend dashboard
   ```

3. **Rate Limiting:**
   ```
   Error: Rate limit exceeded
   Solution: Check Resend plan limits, upgrade if needed
   ```

---

## Step 9: Cleanup

### 9.1 Remove SendGrid Dependencies

**After successful migration:**
```bash
# Remove SendGrid configuration from environment files
# Remove backup files after 30 days
# Update documentation references
```

### 9.2 Update Documentation

**Update relevant documentation:**
- `README.md` - Update email service information
- `app/services/README.md` - Document Resend integration
- Environment variable documentation

---

## Rollback Plan

**If migration fails, rollback steps:**

1. **Revert EmailService:**
   ```bash
   cp backend/app/services/email_service_sendgrid_backup.py backend/app/services/email_service.py
   ```

2. **Revert requirements.txt:**
   ```bash
   # Add back: sendgrid==6.11.0
   # Remove: resend==0.7.0
   ```

3. **Revert environment variables:**
   ```bash
   # Restore SENDGRID_API_KEY
   # Remove RESEND_* variables
   ```

4. **Redeploy:**
   ```bash
   git add .
   git commit -m "rollback: revert to SendGrid email service"
   git push origin main
   ```

---

## Success Criteria

**Migration is successful when:**

- ✅ All refund emails are delivered via Resend
- ✅ Email templates render correctly
- ✅ No SendGrid references in codebase
- ✅ Production environment uses Resend
- ✅ Email delivery monitoring works
- ✅ Cost reduction achieved
- ✅ Integration with DigitalOcean confirmed

---

## Cost Comparison

**SendGrid vs Resend:**

| Feature | SendGrid | Resend |
|---------|----------|---------|
| Free Tier | 100 emails/day | 3,000 emails/month |
| Paid Plans | $19.95/month (40K emails) | $20/month (50K emails) |
| API Quality | Good | Excellent |
| DigitalOcean Integration | None | Native partnership |
| Developer Experience | Complex | Simple |

**Expected Savings:** ~15-20% reduction in email costs + better integration

---

## Support & Resources

- **Resend Documentation:** [resend.com/docs](https://resend.com/docs)
- **API Reference:** [resend.com/docs/api-reference](https://resend.com/docs/api-reference)
- **DigitalOcean Integration:** [docs.digitalocean.com/products/app-platform/how-to/manage-environment-variables](https://docs.digitalocean.com/products/app-platform/how-to/manage-environment-variables)
- **Python SDK:** [github.com/resendlabs/resend-python](https://github.com/resendlabs/resend-python)

---

**End of Migration Guide**