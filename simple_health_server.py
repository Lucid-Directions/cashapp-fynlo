#!/usr/bin/env python3
"""
Simple Health Server for iOS App Testing
Provides basic endpoints that return mock data for development testing
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time
from datetime import datetime

class HealthHandler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        """Handle GET requests"""
        
        # Add CORS headers
        self.send_cors_headers()
        
        if self.path == '/health':
            self.send_health_response()
        elif self.path == '/api/v1/auth/login':
            self.send_mock_login_response()
        elif self.path.startswith('/api/v1/'):
            self.send_mock_api_response()
        else:
            self.send_404_response()
    
    def do_POST(self):
        """Handle POST requests"""
        
        # Add CORS headers
        self.send_cors_headers()
        
        if self.path == '/api/v1/auth/login':
            self.send_mock_login_response()
        elif self.path == '/api/v1/payments/process':
            self.send_mock_payment_response()
        elif self.path.startswith('/api/v1/'):
            self.send_mock_api_response()
        else:
            self.send_404_response()
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_cors_headers()
        self.send_response(200)
        self.end_headers()
    
    def send_cors_headers(self):
        """Send CORS headers for React Native"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def send_health_response(self):
        """Send health check response"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "fynlo-pos-mock-api",
            "version": "1.0.0"
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def send_mock_login_response(self):
        """Send mock login response"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": True,
            "data": {
                "access_token": "mock_access_token_12345",
                "user": {
                    "id": 1,
                    "username": "demo_user",
                    "email": "demo@fynlopos.com",
                    "role": "restaurant_owner"
                }
            },
            "message": "Login successful"
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def send_mock_payment_response(self):
        """Send mock payment processing response"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": True,
            "data": {
                "transaction_id": f"txn_{int(time.time())}",
                "amount": 25.99,
                "currency": "GBP",
                "provider": "sumup",
                "fee": 0.52,
                "net_amount": 25.47,
                "status": "completed"
            },
            "message": "Payment processed successfully"
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def send_mock_api_response(self):
        """Send generic mock API response"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": True,
            "data": [],
            "message": "Mock API response"
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def send_404_response(self):
        """Send 404 response"""
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": False,
            "error": "Endpoint not found",
            "path": self.path
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")

def run_server():
    """Start the health server"""
    server_address = ('0.0.0.0', 8000)
    httpd = HTTPServer(server_address, HealthHandler)
    
    print(f"🚀 Mock API Server starting on http://0.0.0.0:8000")
    print(f"📱 iOS app can connect to: http://192.168.0.109:8000")
    print(f"🏥 Health endpoint: http://192.168.0.109:8000/health")
    print(f"📋 Available endpoints:")
    print(f"   GET  /health - Health check")
    print(f"   POST /api/v1/auth/login - Mock login")
    print(f"   POST /api/v1/payments/process - Mock payment")
    print(f"   GET  /api/v1/* - Generic mock responses")
    print(f"\nPress Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n👋 Shutting down mock server...")
        httpd.shutdown()

if __name__ == '__main__':
    run_server()