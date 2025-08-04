#!/usr/bin/env python3
"""
Generate a secure SECRET_KEY for production deployment
"""
import secrets

def generate_secret_key(length=64):
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(length)

if __name__ == "__main__":
    print("Generated SECRET_KEY for DigitalOcean deployment:")
    print("-" * 60)
    print(generate_secret_key())
    print("-" * 60)
    print("\nAdd this to your DigitalOcean app environment variables.")
    print("NEVER commit this to git or share it publicly!")