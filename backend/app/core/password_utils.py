"""
Password generation utilities for secure password creation
"""
import secrets
import string


def generate_secure_password(length: int = 16) -> str:
    """
    Generate a secure random password.
    
    Args:
        length: The length of the password to generate (default: 16)
        
    Returns:
        A secure random password containing letters, digits, and special characters
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))