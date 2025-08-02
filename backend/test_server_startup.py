#!/usr/bin/env python3
"""
Test server startup and basic API endpoints
"""

import uvicorn
import sys
import time
import requests
from multiprocessing import Process
import logging

logger = logging.getLogger(__name__)


def run_server():
    """Run the FastAPI server"""
    try:
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            log_level="info",
            access_log=False
        )
    except Exception as e:
        logger.error(f"Server failed to start: {e}")

def test_server_endpoints():
    """Test server endpoints"""
    base_url = "http://127.0.0.1:8000"
    
    # Wait for server to start
    logger.info("⏳ Waiting for server to start...")
    time.sleep(3)
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            logger.info("✅ Health endpoint (/) working")
        else:
            logger.info(f"❌ Health endpoint returned {response.status_code}")
            return False
        
        # Test health check
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            logger.info("✅ Health check endpoint (/health) working")
        else:
            logger.info(f"❌ Health check endpoint returned {response.status_code}")
            return False
        
        # Test API docs
        response = requests.get(f"{base_url}/docs", timeout=5)
        if response.status_code == 200:
            logger.info("✅ API documentation (/docs) accessible")
        else:
            logger.info(f"⚠️ API docs returned {response.status_code}")
        
        # Test OpenAPI schema
        response = requests.get(f"{base_url}/openapi.json", timeout=5)
        if response.status_code == 200:
            logger.info("✅ OpenAPI schema (/openapi.json) accessible")
        else:
            logger.info(f"⚠️ OpenAPI schema returned {response.status_code}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        logger.info("❌ Could not connect to server")
        return False
    except requests.exceptions.Timeout:
        logger.info("❌ Server request timed out")
        return False
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        return False

def main():
    """Main test function"""
    logger.info("🚀 Testing FastAPI Server Startup")
    logger.info("=" * 40)
    
    # Start server in separate process
    server_process = Process(target=run_server)
    server_process.start()
    
    try:
        # Test endpoints
        success = test_server_endpoints()
        
        if success:
            logger.info("\n🎉 Server startup test PASSED!")
            logger.info("✅ Backend is ready for production use")
        else:
            logger.error("\n❌ Server startup test FAILED!")
            logger.error("⚠️ Check server logs for errors")
            
    finally:
        # Clean shutdown
        logger.info("\n🛑 Shutting down test server...")
        server_process.terminate()
        server_process.join(timeout=5)
        if server_process.is_alive():
            server_process.kill()
        logger.info("✅ Server shutdown complete")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("\n❌ Test interrupted by user")
        sys.exit(1) 