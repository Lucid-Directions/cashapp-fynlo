#!/usr/bin/env python3
"""
Test production authentication endpoint
"""

import requests
import json
import logging

logger = logging.getLogger(__name__)


# Test the production verify endpoint
url = 'https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify'

# Test with a fake token to see the error response
headers = {
    'Authorization': 'Bearer fake-token-12345',
    'Content-Type': 'application/json'
}

logger.info("Testing production auth verify endpoint...")
logger.info(f"URL: {url}")
logger.info(f"Headers: {headers}")

try:
    response = requests.post(url, headers=headers)
    logger.info(f"\nStatus Code: {response.status_code}")
    logger.info(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Also test the Supabase config endpoint
    logger.info("\n\nTesting Supabase config endpoint...")
    config_url = 'https://fynlopos-9eg2c.ondigitalocean.app/api/v1/test/supabase-config'
    config_response = requests.get(config_url)
    logger.info(f"Config Status: {config_response.status_code}")
    logger.info(f"Config Response: {json.dumps(config_response.json(), indent=2)}")
    
except Exception as e:
    logger.error(f"Error: {e}")
