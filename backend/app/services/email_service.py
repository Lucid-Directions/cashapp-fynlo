"""
Email Service using Resend API for Fynlo POS
Handles transactional emails including receipt delivery
"""

import logging
from typing import Literal, Optional, Dict, Any
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

# Define TYPES for backward compatibility
TYPES = Literal["sale", "refund"]

class EmailService:
    """Email service using Resend API for transactional emails"""
    
    def __init__(self):
        """Initialize Resend email service"""
        try:
            # Get configuration from settings
            self.api_key = settings.RESEND_API_KEY
            self.from_addr = settings.RESEND_FROM_EMAIL
            self.from_name = settings.RESEND_FROM_NAME
            
            if not self.api_key:
                logger.error("RESEND_API_KEY not configured")
                self.sg = None  # Keep for backward compatibility
                self.env = None
                return
            
            # Configure Resend
            resend.api_key = self.api_key
            
            # Setup Jinja2 for email templates - same path structure as before
            templates_dir = Path(__file__).resolve().parent.parent / "templates" / "email"
            if not templates_dir.exists():
                logger.info(f"Templates directory {templates_dir} does not exist. Creating it.")
                templates_dir.mkdir(parents=True, exist_ok=True)

            self.env = Environment(
                loader=FileSystemLoader(str(templates_dir)),
                autoescape=select_autoescape(["html", "xml"])
            )
            
            # Set sg to True for backward compatibility checks
            self.sg = True
            
            logger.info(f"EmailService initialized with Resend - From: {self.from_addr}")
            
        except Exception as e:
            logger.exception(f"Error initializing EmailService: {e}")
            self.sg = None
            self.env = None
    
    def send_receipt(self, *, order: Any, type_: TYPES, amount: float) -> bool:
        """
        Send receipt email for sale or refund
        
        Args:
            order: Order object with order details
            type_: Email type ("sale" or "refund")
            amount: Transaction amount
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.sg or not self.env:
            logger.error("EmailService not properly initialized (Resend client or Jinja env missing). Cannot send email.")
            return False

        if not hasattr(order, 'customer_email') or not order.customer_email:
            logger.info(f"Order #{getattr(order, 'order_number', getattr(order, 'number', 'N/A'))} has no customer_email. Skipping receipt sending.")
            return False

        try:
            # Generate email content from template
            template_name = "receipt.html"
            tmpl = self.env.get_template(template_name)
            html_content = tmpl.render(order=order, type=type_, amount=amount)
            
            # Determine email subject
            order_number = getattr(order, 'order_number', getattr(order, 'number', 'N/A'))
            subject = f"Fynlo – {'Refund' if type_=='refund' else 'Receipt'} for #{order_number}"
            
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
                logger.info(f"Receipt email sent for order #{order_number} to {order.customer_email}. Type: {type_}. Resend ID: {response['id']}")
                return True
            else:
                logger.error(f"Failed to send receipt email - Invalid response: {response}")
                return False
                
        except Exception as e:
            logger.exception(f"Error sending receipt email for order #{getattr(order, 'order_number', 'N/A')}: {e}")
            return False
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
        if not self.sg:
            logger.error("EmailService not properly initialized. Cannot send email.")
            return False
            
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
                logger.info(f"Custom email sent successfully to {to_email} - ID: {response['id']}")
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
            if not self.sg:
                logger.error("Resend not properly initialized")
                return False
                
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

# Example Usage (for testing or if run directly, though typically not)
if __name__ == '__main__':
    logger.info("EmailService module loaded. Now using Resend instead of SendGrid.")