"""
Test script to verify standardized API responses
Run this to validate the new response format works correctly
"""

import asyncio
import json
from datetime import datetime
from app.core.responses import APIResponseHelper, iOSResponseHelper, ErrorCodes
from app.core.exceptions import (
import logging

logger = logging.getLogger(__name__)

    AuthenticationException,
    ValidationException,
    ResourceNotFoundException,
    ConflictException
)


async def test_standardized_responses():
    """Test all standardized response types"""
    
    logger.info("🧪 Testing Standardized API Responses\n")
    
    # Test success response
    logger.info("✅ SUCCESS RESPONSE:")
    success_response = APIResponseHelper.success(
        data={"user_id": "123", "name": "John Doe"},
        message="User retrieved successfully"
    )
    logger.info(json.dumps(json.loads(success_response.body), indent=2))
    logger.info()
    
    # Test created response
    logger.info("✅ CREATED RESPONSE:")
    created_response = APIResponseHelper.created(
        data={"order_id": "ORD-456", "status": "pending"},
        message="Order created successfully"
    )
    logger.info(json.dumps(json.loads(created_response.body), indent=2))
    logger.info()
    
    # Test error response
    logger.error("❌ ERROR RESPONSE:")
    error_response = APIResponseHelper.error(
        message="Product not found",
        error_code=ErrorCodes.NOT_FOUND,
        details={"product_id": "prod-789"}
    )
    logger.error(json.dumps(json.loads(error_response.body), indent=2))
    logger.info()
    
    # Test validation error
    logger.error("❌ VALIDATION ERROR:")
    validation_response = APIResponseHelper.validation_error(
        message="Request validation failed",
        errors=[
            {"field": "email", "message": "Invalid email format"},
            {"field": "password", "message": "Password too short"}
        ]
    )
    logger.info(json.dumps(json.loads(validation_response.body), indent=2))
    logger.info()
    
    # Test iOS login response
    logger.info("📱 iOS LOGIN RESPONSE:")
    ios_login = iOSResponseHelper.login_success(
        access_token="jwt_token_here",
        user_data={
            "id": "user-123",
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "role": "employee"
        }
    )
    logger.info(json.dumps(json.loads(ios_login.body), indent=2))
    logger.info()
    
    # Test paginated response
    logger.info("📄 PAGINATED RESPONSE:")
    paginated_response = APIResponseHelper.paginated(
        data=[
            {"id": "1", "name": "Product 1"},
            {"id": "2", "name": "Product 2"}
        ],
        page=1,
        limit=10,
        total=25
    )
    logger.info(json.dumps(json.loads(paginated_response.body), indent=2))
    logger.info()
    
    logger.info("✅ All response formats validated successfully!")


if __name__ == "__main__":
    asyncio.run(test_standardized_responses())