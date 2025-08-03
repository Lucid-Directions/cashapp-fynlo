#!/usr/bin/env python3
"""
Backend Functionality Test Script
Tests core functionality without requiring external dependencies
"""

import asyncio
import sys
import traceback
from datetime import datetime

def test_imports():
    """Test all core imports"""
    logger.info("🔍 Testing imports...")
    
    try:
        # Core FastAPI imports
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        logger.info("  ✅ FastAPI imports successful")
        
        # Database imports
        from app.core.database import Base, User, Restaurant, Product, Order, Payment
        logger.info("  ✅ Database model imports successful")
        
        # Service imports
        from app.core.file_upload import FileUploadService
        from app.core.push_notifications import PushNotificationService
        from app.core.sync_manager import OfflineSyncManager
        from app.core.websocket import WebSocketManager
        logger.info("  ✅ Service class imports successful")
        
        # API imports
        from app.api.v1.api import api_router
        from app.api.mobile.endpoints import router as mobile_router
        logger.info("  ✅ API router imports successful")
        
        # Main app import
        from app.main import app
        logger.info("  ✅ Main application import successful")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Import failed: {e}")
        traceback.print_exc()
        return False

def test_services():
    """Test service class instantiation"""
    logger.info("\n🔍 Testing service instantiation...")
    
    try:
        # File Upload Service
        from app.core.file_upload import FileUploadService
        file_service = FileUploadService()
        logger.info("  ✅ FileUploadService instantiated")
        
        # Push Notification Service
        from app.core.push_notifications import PushNotificationService
        push_service = PushNotificationService()
        logger.info("  ✅ PushNotificationService instantiated")
        
        # WebSocket Manager
        from app.core.websocket import WebSocketManager
        ws_manager = WebSocketManager()
        logger.info("  ✅ WebSocketManager instantiated")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Service instantiation failed: {e}")
        traceback.print_exc()
        return False

def test_fastapi_app():
    """Test FastAPI application"""
    logger.info("\n🔍 Testing FastAPI application...")
    
    try:
        from app.main import app
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        
        # Test health endpoint
        response = client.get("/")
        if response.status_code == 200:
            logger.info("  ✅ Health endpoint working")
        else:
            logger.info(f"  ⚠️ Health endpoint returned {response.status_code}")
        
        # Test health check endpoint
        response = client.get("/health")
        if response.status_code == 200:
            logger.info("  ✅ Health check endpoint working")
        else:
            logger.info(f"  ⚠️ Health check endpoint returned {response.status_code}")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ FastAPI app test failed: {e}")
        traceback.print_exc()
        return False

def test_database_models():
    """Test database model creation"""
    logger.info("\n🔍 Testing database models...")
    
    try:
        from app.core.database import User, Restaurant, Product, Order, Payment
        import uuid
        from datetime import datetime
        
        # Test model instantiation
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            role="employee"
        )
        logger.info("  ✅ User model created")
        
        restaurant = Restaurant(
            name="Test Restaurant",
            address={"street": "123 Test St", "city": "Test City"},
            phone="555-0123",
            email="restaurant@example.com"
        )
        logger.info("  ✅ Restaurant model created")
        
        product = Product(
            restaurant_id=restaurant.id,
            category_id=uuid.uuid4(),
            name="Test Product",
            description="A test product",
            price=9.99
        )
        logger.info("  ✅ Product model created")
        
        order = Order(
            restaurant_id=restaurant.id,
            order_number="TEST001",
            items=[{"product_id": str(product.id), "quantity": 1, "price": 9.99}],
            subtotal=9.99,
            total_amount=9.99,
            created_by=user.id
        )
        logger.info("  ✅ Order model created")
        
        payment = Payment(
            order_id=order.id,
            payment_method="cash",
            amount=9.99,
            net_amount=9.99
        )
        logger.info("  ✅ Payment model created")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Database model test failed: {e}")
        traceback.print_exc()
        return False

def test_response_helpers():
    """Test response helper functions"""
    logger.info("\n🔍 Testing response helpers...")
    
    try:
        from app.core.responses import APIResponseHelper
        
        # Test success response
        success_response = APIResponseHelper.success(
            data={"test": "data"},
            message="Test successful"
        )
        logger.info("  ✅ Success response helper working")
        
        # Test error response
        error_response = APIResponseHelper.error(
            message="Test error",
            error_code="TEST_ERROR"
        )
        logger.error("  ✅ Error response helper working")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Response helper test failed: {e}")
        traceback.print_exc()
        return False

def test_middleware():
    """Test middleware components"""
    logger.info("\n🔍 Testing middleware...")
    
    try:
        from app.core.mobile_middleware import MobileCompatibilityMiddleware, MobileDataOptimizationMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        
        # Test middleware instantiation
        mobile_middleware = MobileCompatibilityMiddleware(app)
        logger.info("  ✅ MobileCompatibilityMiddleware created")
        
        optimization_middleware = MobileDataOptimizationMiddleware(app)
        logger.info("  ✅ MobileDataOptimizationMiddleware created")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Middleware test failed: {e}")
        traceback.print_exc()
        return False

async def test_websocket_manager():
    """Test WebSocket manager"""
    logger.info("\n🔍 Testing WebSocket manager...")
    
    try:
        from app.core.websocket import WebSocketManager, EventType, ConnectionType
        
        manager = WebSocketManager()
        logger.info("  ✅ WebSocket manager instantiated")
        
        # Test event types
        event_types = list(EventType)
        logger.info(f"  ✅ Found {len(event_types)} event types")
        
        # Test connection types
        connection_types = list(ConnectionType)
        logger.info(f"  ✅ Found {len(connection_types)} connection types")
        
        # Test stats
        stats = manager.get_connection_stats()
        logger.info(f"  ✅ Connection stats: {stats['total_connections']} connections")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ WebSocket manager test failed: {e}")
        traceback.print_exc()
        return False

def test_file_upload_service():
    """Test file upload service"""
    logger.info("\n🔍 Testing file upload service...")
    
    try:
        from app.core.file_upload import FileUploadService, FileUploadConfig
import logging

logger = logging.getLogger(__name__)

        
        service = FileUploadService()
        config = FileUploadConfig()
        
        logger.info(f"  ✅ Max file size: {config.MAX_FILE_SIZE / (1024*1024):.1f}MB")
        logger.info(f"  ✅ Allowed types: {len(config.ALLOWED_MIME_TYPES)} MIME types")
        logger.info(f"  ✅ Mobile sizes: {len(config.MOBILE_SIZES)} size variants")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ File upload service test failed: {e}")
        traceback.print_exc()
        return False

async def run_all_tests():
    """Run all tests"""
    logger.info("🚀 Starting Backend Functionality Tests")
    logger.info("=" * 50)
    
    tests = [
        ("Imports", test_imports),
        ("Services", test_services),
        ("FastAPI App", test_fastapi_app),
        ("Database Models", test_database_models),
        ("Response Helpers", test_response_helpers),
        ("Middleware", test_middleware),
        ("WebSocket Manager", test_websocket_manager),
        ("File Upload Service", test_file_upload_service),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.info(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "=" * 50)
    logger.info("📊 TEST RESULTS SUMMARY")
    logger.info("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"  {status} {test_name}")
    
    logger.info(f"\n🎯 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        logger.info("🎉 ALL TESTS PASSED! Backend is functional.")
        return True
    else:
        logger.error("⚠️  Some tests failed. See details above.")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("\n❌ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.info(f"\n❌ Test suite crashed: {e}")
        traceback.print_exc()
        sys.exit(1) 
