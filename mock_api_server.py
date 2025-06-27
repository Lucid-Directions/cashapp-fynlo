#!/usr/bin/env python3
"""
Mock API Server for Fynlo POS
Responds to expected endpoints with proper JSON responses
"""

from flask import Flask, jsonify, request
from datetime import datetime
import json

app = Flask(__name__)

# Enable CORS for all routes
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Health endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "fynlo-pos-mock-api",
        "version": "1.0.0"
    })

# Platform settings service charge endpoint
@app.route('/api/v1/platform-settings/service-charge', methods=['GET'])
def get_service_charge():
    return jsonify({
        "success": True,
        "data": {
            "enabled": True,
            "rate": 12.5,
            "description": "Platform service charge"
        },
        "message": "Service charge configuration retrieved"
    })

# Platform settings endpoints
@app.route('/api/v1/platform-settings/settings', methods=['GET'])
def get_platform_settings():
    return jsonify({
        "success": True,
        "data": {
            "payment.fees.qr_code": {
                "value": {"percentage": 1.2, "currency": "GBP"},
                "category": "payment_fees",
                "description": "QR Code payment processing fee",
                "is_sensitive": False,
                "updated_at": "2024-06-22T10:30:00Z"
            },
            "payment.fees.sumup": {
                "value": {"percentage": 1.95, "currency": "GBP"},
                "category": "payment_fees",
                "description": "SumUp payment processing fee",
                "is_sensitive": False,
                "updated_at": "2024-06-22T10:30:00Z"
            }
        }
    })

# Auth login endpoint
@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    return jsonify({
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
    })

# Products endpoint
@app.route('/api/v1/products/mobile', methods=['GET'])
def get_mobile_products():
    return jsonify({
        "success": True,
        "data": [
            {"id": 1, "name": "Classic Burger", "price": 12.99, "category": "Main"},
            {"id": 2, "name": "Caesar Salad", "price": 9.99, "category": "Salads"},
            {"id": 3, "name": "Margherita Pizza", "price": 15.99, "category": "Main"}
        ]
    })

# Payment processing endpoint
@app.route('/api/v1/payments/process', methods=['POST'])
def process_payment():
    return jsonify({
        "success": True,
        "data": {
            "transaction_id": f"txn_{int(datetime.now().timestamp())}",
            "amount": 25.99,
            "currency": "GBP",
            "provider": "sumup",
            "fee": 0.52,
            "net_amount": 25.47,
            "status": "completed"
        },
        "message": "Payment processed successfully"
    })

# Categories endpoint
@app.route('/api/v1/categories', methods=['GET'])
def get_categories():
    return jsonify({
        "success": True,
        "data": [
            {"id": 1, "name": "Main", "active": True},
            {"id": 2, "name": "Appetizers", "active": True},
            {"id": 3, "name": "Salads", "active": True}
        ]
    })

# Orders endpoint
@app.route('/api/v1/orders/recent', methods=['GET'])
def get_recent_orders():
    return jsonify({
        "success": True,
        "data": []
    })

# POS sessions endpoint
@app.route('/api/v1/pos/sessions/current', methods=['GET'])
def get_current_session():
    return jsonify({
        "success": True,
        "data": None
    })

# Floor plan endpoint
@app.route('/api/v1/restaurants/floor-plan', methods=['GET'])
def get_floor_plan():
    return jsonify({
        "success": True,
        "data": {
            "tables": [],
            "sections": []
        }
    })

# Catch-all for other API endpoints
@app.route('/api/v1/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def catch_all_api(path):
    return jsonify({
        "success": True,
        "data": {},
        "message": f"Mock response for /{path}"
    })

# 404 handler
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "path": request.path
    }), 404

if __name__ == '__main__':
    print("🚀 Starting Fynlo Mock API Server")
    print("📱 iOS app can connect to: http://192.168.0.109:8000")
    print("🏥 Health endpoint: http://192.168.0.109:8000/health")
    print("💼 Service charge: http://192.168.0.109:8000/api/v1/platform-settings/service-charge")
    print("\nPress Ctrl+C to stop")
    
    # Run on all interfaces so iOS device can connect
    app.run(host='0.0.0.0', port=8000, debug=True)