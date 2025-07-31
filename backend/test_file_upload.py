#!/usr/bin/env python3
"""
Test script for File Upload System
Tests base64 image upload functionality for iOS integration
"""

import base64
import requests
import json
import os
from io import BytesIO
from PIL import Image

# Test configuration
BASE_URL = "http://localhost:8000"
API_VERSION = "v1"

# Test endpoints
ENDPOINTS = {
    "login": f"{BASE_URL}/api/{API_VERSION}/auth/login",
    "product_image": f"{BASE_URL}/api/{API_VERSION}/files/products",
    "restaurant_logo": f"{BASE_URL}/api/{API_VERSION}/files/restaurants"
}

def create_test_image_base64(size=(300, 300), color='red'):
    """Create a test image and return base64 encoded data"""
    # Create test image
    img = Image.new('RGB', size, color)
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode('utf-8')

def test_file_upload_validation():
    """Test file upload validation"""
    logger.info("🧪 Testing File Upload Validation...")
    
    # Test 1: Invalid base64
    logger.info("\n1. Testing invalid base64...")
    invalid_base64 = "not_valid_base64"
    
    from app.core.file_upload import file_upload_service
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=invalid_base64,
            upload_type="product"
        )
        logger.error("❌ Should have failed for invalid base64")
    except Exception as e:
        logger.info(f"✅ Correctly rejected invalid base64: {str(e)}")
    
    # Test 2: Valid image upload
    logger.info("\n2. Testing valid image upload...")
    test_image = create_test_image_base64(size=(200, 200), color='blue')
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=test_image,
            upload_type="product",
            filename="test_product.jpg"
        )
        logger.info(f"✅ Upload successful: {result.file_id}")
        logger.info(f"   Original URL: {result.original_url}")
        logger.info(f"   Thumbnail URL: {result.thumbnail_url}")
        logger.info(f"   Variants: {list(result.variants.keys())}")
    except Exception as e:
        logger.error(f"❌ Upload failed: {str(e)}")

def test_mobile_optimization():
    """Test mobile optimization features"""
    logger.info("\n🔍 Testing Mobile Optimization...")
    
    from app.core.file_upload import file_upload_service
    
    # Create large test image
    large_image = create_test_image_base64(size=(2500, 2500), color='green')
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=large_image,
            upload_type="product",
            filename="large_test.jpg",
            generate_variants=True
        )
        
        logger.info(f"✅ Large image processed successfully")
        logger.info(f"   Generated variants: {len(result.variants)}")
        
        for variant_name, variant_info in result.variants.items():
            logger.info(f"   {variant_name}: {variant_info['size']} -> {variant_info['url']}")
            
    except Exception as e:
        logger.error(f"❌ Large image processing failed: {str(e)}")

def test_api_endpoints():
    """Test API endpoints with authentication"""
    logger.info("\n🌐 Testing API Endpoints...")
    
    # Note: This would require a running server and valid credentials
    logger.info("⚠️  API endpoint testing requires running server")
    logger.info("   Test manually with:")
    logger.info(f"   POST {ENDPOINTS['product_image']}/{{product_id}}/image")
    logger.info("   Body: {\"image_data\": \"<base64_encoded_image>\"}")

def test_ios_integration():
    """Test iOS-specific features"""
    logger.info("\n📱 Testing iOS Integration Features...")
    
    # Test data URL format (common in mobile apps)
    test_image_data = create_test_image_base64(size=(150, 150), color='purple')
    data_url = f"data:image/jpeg;base64,{test_image_data}"
    
    from app.core.file_upload import file_upload_service
import logging

logger = logging.getLogger(__name__)

    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=data_url,
            upload_type="product",
            filename="ios_test.jpg"
        )
        logger.info("✅ Data URL format processed successfully")
        logger.info(f"   File ID: {result.file_id}")
        
        # Test multiple size variants (mobile needs different densities)
        variants = result.variants
        required_sizes = ['thumbnail', 'small', 'medium', 'large']
        
        for size in required_sizes:
            if size in variants:
                logger.info(f"   ✅ {size}: {variants[size]['size']}")
            else:
                logger.info(f"   ❌ Missing {size} variant")
                
    except Exception as e:
        logger.error(f"❌ iOS integration test failed: {str(e)}")

def main():
    """Run all file upload tests"""
    logger.info("🚀 Fynlo POS File Upload System Tests")
    logger.info("=" * 50)
    
    try:
        test_file_upload_validation()
        test_mobile_optimization()
        test_ios_integration()
        test_api_endpoints()
        
        logger.info("\n" + "=" * 50)
        logger.info("✅ File Upload System Tests Completed")
        logger.info("\nNext steps:")
        logger.info("1. Start the server: uvicorn app.main:app --reload")
        logger.info("2. Test endpoints with actual product IDs")
        logger.info("3. Verify file serving works correctly")
        
    except ImportError as e:
        logger.error(f"❌ Import error: {e}")
        logger.info("Make sure you're running from the backend directory")
        logger.info("Install dependencies: pip install -r requirements.txt")
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")

if __name__ == "__main__":
    main()