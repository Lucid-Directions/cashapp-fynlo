#!/usr/bin/env python3
"""
Quick fix for payments.py syntax error
"""

# Read the file and fix the syntax error
with open('/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend/app/api/v1/endpoints/payments.py', 'r') as f:
    content = f.read()

# Replace the problematic line continuation
problematic_section = '''    except stripe.error.StripeError as e:\n        # Update payment record to failed status\n        payment.status = "failed"\n        payment.payment_metadata.update({"stripe_error": str(e)})\n        logger.error(f"Stripe payment failed: {str(e)}")\n        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")\n    except Exception as e:\n        logger.error(f"Unexpected error during Stripe payment: {e}")\n        raise HTTPException(status_code=500, detail="Payment processing failed")\n    \n    \n    except stripe.error.StripeError as e:
        logger.error(f"Stripe payment failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")'''

fixed_section = '''    except stripe.error.StripeError as e:
        # Update payment record to failed status
        payment.status = "failed"
        payment.payment_metadata.update({"stripe_error": str(e)})
        logger.error(f"Stripe payment failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Payment failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during Stripe payment: {e}")
        raise HTTPException(status_code=500, detail="Payment processing failed")'''

# Replace the content
content = content.replace(problematic_section, fixed_section)

# Write back
with open('/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend/app/api/v1/endpoints/payments.py', 'w') as f:
    f.write(content)

print("✅ Fixed payments.py syntax error")