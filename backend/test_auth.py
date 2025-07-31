#!/usr/bin/env python3
"""
Test authentication endpoint with a sample Supabase token
"""

import requests
import json
import logging

logger = logging.getLogger(__name__)


# API endpoint
API_URL = "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify"

def test_auth_without_token():
    """Test authentication without token"""
    logger.info("1. Testing without authorization header...")
    response = requests.post(API_URL)
    logger.info(f"   Status: {response.status_code}")
    logger.info(f"   Response: {response.text}\n")

def test_auth_with_invalid_token():
    """Test authentication with invalid token"""
    logger.info("2. Testing with invalid token...")
    headers = {
        "Authorization": "Bearer invalid_token_12345"
    }
    response = requests.post(API_URL, headers=headers)
    logger.info(f"   Status: {response.status_code}")
    logger.info(f"   Response: {response.text}\n")

def test_auth_with_malformed_header():
    """Test authentication with malformed header"""
    logger.info("3. Testing with malformed authorization header...")
    headers = {
        "Authorization": "invalid_format"
    }
    response = requests.post(API_URL, headers=headers)
    logger.info(f"   Status: {response.status_code}")
    logger.info(f"   Response: {response.text}\n")

def main():
    logger.info("=== Testing Fynlo Authentication Endpoint ===\n")
    logger.info(f"API URL: {API_URL}\n")
    
    # Run tests
    test_auth_without_token()
    test_auth_with_invalid_token()
    test_auth_with_malformed_header()
    
    logger.info("=== Authentication Tests Complete ===")
    logger.info("\nNOTE: To test with a valid token, you need to:")
    logger.info("1. Sign in through the Fynlo app or Supabase dashboard")
    logger.info("2. Extract the JWT token from the authorization header")
    logger.info("3. Use it in the 'Authorization: Bearer <token>' header")

if __name__ == "__main__":
    main()