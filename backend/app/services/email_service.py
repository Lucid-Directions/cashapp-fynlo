import os
from typing import Literal # Python 3.8+
# For older Python, from typing_extensions import Literal
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Content, Email # Corrected import for Content and Email
import logging

logger = logging.getLogger(__name__)

# Define TYPES, ensure Literal is correctly imported based on Python version
# For this environment, assume Python 3.8+ for direct typing.Literal
TYPES = Literal["sale", "refund"]

class EmailService:
    def __init__(self):
        # Determine the correct path to the templates directory
        # Assuming this service file is in backend/app/services/email_service.py
        # Then root should be backend/app/templates/email/
        try:
            templates_dir = Path(__file__).resolve().parent.parent / "templates" / "email"
            if not templates_dir.exists():
                logger.info(f"Templates directory {templates_dir} does not exist. Creating it.")
                templates_dir.mkdir(parents=True, exist_ok=True)

            self.env = Environment(
                loader=FileSystemLoader(str(templates_dir)),
                autoescape=select_autoescape(["html", "xml"])
            )

            sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
            if not sendgrid_api_key:
                logger.error("SENDGRID_API_KEY environment variable not set. Email service will not be functional.")
                # Raise an error or handle this gracefully depending on requirements
                # For now, allow initialization but sending will fail.
                self.sg = None
            else:
                self.sg = SendGridAPIClient(sendgrid_api_key)

            self.from_addr = os.environ.get("EMAIL_FROM", "no-reply@fynlo.com")
            logger.info(f"EmailService initialized. From address: {self.from_addr}. Templates dir: {templates_dir}")

        except Exception as e:
            logger.exception(f"Error initializing EmailService: {e}")
            self.sg = None # Ensure sg is None if init fails
            self.env = None


    def send_receipt(self, *, order: Any, type_: TYPES, amount: float) -> bool:
        if not self.sg or not self.env:
            logger.error("EmailService not properly initialized (SendGrid client or Jinja env missing). Cannot send email.")
            return False

        if not hasattr(order, 'customer_email') or not order.customer_email:
            logger.info(f"Order #{getattr(order, 'number', 'N/A')} has no customer_email. Skipping receipt sending.")
            return False

        try:
            template_name = "receipt.html" # Using one template with conditional logic
            tmpl = self.env.get_template(template_name)

            # Ensure order object has necessary attributes (order.number, order.lines, order.total)
            # These might need to be mapped from the actual order object passed.
            # For example, if order is an SQLAlchemy model:
            # order_data = {
            #     "number": order.order_number,
            #     "customer_email": order.customer_email_column, # map to actual column
            #     "lines": [{"qty": li.quantity, "name": li.product_name, "total": li.price} for li in order.items_relationship],
            #     "total": order.total_amount
            # }
            # For now, assuming 'order' object directly has .number, .lines, .total, .customer_email

            html_content = tmpl.render(order=order, type=type_, amount=amount)

            subject = f"Fynlo – {'Refund' if type_=='refund' else 'Receipt'} for #{getattr(order, 'order_number', getattr(order, 'number', 'N/A'))}"

            message = Mail(
                from_email=Email(self.from_addr, "Fynlo POS"), # Using Email helper for from_email
                to_emails=order.customer_email,
                subject=subject,
                html_content=Content("text/html", html_content) # Using Content helper
            )

            response = self.sg.send(message)

            logger.info(f"Receipt email sent for order #{getattr(order, 'order_number', 'N/A')} to {order.customer_email}. Type: {type_}. Status Code: {response.status_code}")
            return 200 <= response.status_code < 300
        except Exception as e:
            logger.exception(f"Error sending receipt email for order #{getattr(order, 'order_number', 'N/A')}: {e}")
            return False

# Example Usage (for testing or if run directly, though typically not)
if __name__ == '__main__':
    # This part would require mocking os.environ and the order object for a real test
    # For demonstration purposes only
    logger.info("EmailService module loaded. Not for direct execution in production.")
    # Example:
    # os.environ['SENDGRID_API_KEY'] = 'YOUR_SG_KEY'
    # os.environ['EMAIL_FROM'] = 'test@example.com'
    # class MockOrder:
    #     def __init__(self):
    #         self.order_number = "12345"
    #         self.customer_email = "customer@example.com"
    #         self.lines = [{"qty": 1, "name": "Test Item", "total": 10.00}]
    #         self.total = 10.00
    # mock_order = MockOrder()
    # email_service = EmailService()
    # if email_service.sg:
    #    email_service.send_receipt(order=mock_order, type_='sale', amount=10.00)
    #    email_service.send_receipt(order=mock_order, type_='refund', amount=5.00)
    # else:
    #    print("EmailService could not be initialized (likely missing SENDGRID_API_KEY).")
