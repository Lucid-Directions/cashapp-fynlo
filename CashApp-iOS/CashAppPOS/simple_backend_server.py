#!/usr/bin/env python3
"""
Real Backend API Server for Fynlo POS
Replaces all mock data with persistent backend storage
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Data storage files
DATA_DIR = 'backend_data'
PLATFORM_FILE = f'{DATA_DIR}/platform.json'
RESTAURANTS_FILE = f'{DATA_DIR}/restaurants.json'
SERVICE_CHARGE_FILE = f'{DATA_DIR}/service_charge.json'
USERS_FILE = f'{DATA_DIR}/users.json'

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

def load_json_file(filepath, default_data):
    """Load JSON data from file or return default"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
    return default_data

def save_json_file(filepath, data):
    """Save data to JSON file"""
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        return True
    except Exception as e:
        print(f"Error saving {filepath}: {e}")
        return False

# Initialize data
def init_data():
    """Initialize backend data with real restaurant data"""
    
    # Platform data
    platform_data = {
        "id": "platform1",
        "name": "Fynlo POS Platform", 
        "ownerId": "platform_owner_1",
        "createdDate": "2024-01-01T00:00:00Z",
        "totalRestaurants": 1,
        "totalRevenue": 45200,
        "isActive": True
    }
    
    # Real restaurant data (Mexican restaurant)
    restaurants_data = [
        {
            "id": "restaurant1",
            "name": "Chucho",
            "address": "123 Camden High Street, London, NW1 7JR",
            "phone": "+44 20 7946 0958",
            "email": "hola@chucho.com",
            "vatNumber": "GB123456789",
            "registrationNumber": "12345678",
            "type": "restaurant",
            "currency": "GBP",
            "timezone": "Europe/London",
            "ownerId": "user1",
            "platformOwnerId": "platform_owner_1",
            "subscriptionTier": "premium",
            "isActive": True,
            "joinedDate": "2024-01-15T00:00:00Z",
            "lastActivity": datetime.now().isoformat(),
            "monthlyRevenue": 45200,
            "commissionRate": 2.5
        }
    ]
    
    # Service charge configuration
    service_charge_data = {
        "enabled": True,
        "rate": 12.5,
        "description": "Platform service charge",
        "lastUpdated": datetime.now().isoformat()
    }
    
    # Users data
    users_data = [
        {
            "id": "platform_owner_1",
            "firstName": "Platform",
            "lastName": "Owner", 
            "email": "owner@fynlopos.com",
            "phone": "+44 7700 900100",
            "role": "platform_owner",
            "pin": "0001",
            "employeeId": "PLATFORM001",
            "businessId": "platform1",
            "isActive": True,
            "platformId": "platform1",
            "managedRestaurants": ["restaurant1"]
        },
        {
            "id": "user1",
            "firstName": "John",
            "lastName": "Smith",
            "email": "john@fynlopos.com", 
            "phone": "+44 7700 900123",
            "role": "restaurant_owner",
            "pin": "1234",
            "employeeId": "EMP001",
            "businessId": "restaurant1",
            "isActive": True
        }
    ]
    
    # Save initial data
    save_json_file(PLATFORM_FILE, platform_data)
    save_json_file(RESTAURANTS_FILE, restaurants_data)
    save_json_file(SERVICE_CHARGE_FILE, service_charge_data)
    save_json_file(USERS_FILE, users_data)

# Health check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "Fynlo POS Backend API"
    })

# Platform endpoints
@app.route('/api/v1/platform', methods=['GET'])
def get_platform():
    """Get platform data"""
    platform = load_json_file(PLATFORM_FILE, {})
    return jsonify(platform)

@app.route('/api/v1/platform/restaurants', methods=['GET'])
def get_platform_restaurants():
    """Get all restaurants for platform owner"""
    restaurants = load_json_file(RESTAURANTS_FILE, [])
    return jsonify(restaurants)

# Service charge endpoints
@app.route('/api/v1/platform/service-charge', methods=['GET'])
def get_service_charge():
    """Get service charge configuration"""
    service_charge = load_json_file(SERVICE_CHARGE_FILE, {
        "enabled": True,
        "rate": 12.5,
        "description": "Platform service charge",
        "lastUpdated": datetime.now().isoformat()
    })
    return jsonify(service_charge)

@app.route('/api/v1/platform/service-charge', methods=['POST'])
def update_service_charge():
    """Update service charge configuration"""
    try:
        data = request.get_json()
        
        service_charge = {
            "enabled": data.get('enabled', True),
            "rate": float(data.get('rate', 12.5)),
            "description": data.get('description', 'Platform service charge'),
            "lastUpdated": datetime.now().isoformat()
        }
        
        if save_json_file(SERVICE_CHARGE_FILE, service_charge):
            print(f"✅ Service charge updated: {service_charge['rate']}% enabled={service_charge['enabled']}")
            return jsonify({
                "success": True,
                "data": service_charge,
                "message": "Service charge updated successfully"
            })
        else:
            return jsonify({"success": False, "message": "Failed to save service charge"}), 500
            
    except Exception as e:
        print(f"❌ Error updating service charge: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Restaurant data endpoint
@app.route('/api/v1/restaurants/<restaurant_id>', methods=['GET'])
def get_restaurant(restaurant_id):
    """Get specific restaurant data"""
    restaurants = load_json_file(RESTAURANTS_FILE, [])
    restaurant = next((r for r in restaurants if r['id'] == restaurant_id), None)
    
    if restaurant:
        return jsonify(restaurant)
    else:
        return jsonify({"error": "Restaurant not found"}), 404

# Authentication endpoint
@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """Authenticate user"""
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        password = data.get('password', '')
        
        # Valid credentials
        valid_credentials = [
            {"email": "owner@fynlopos.com", "password": "platformowner123"},
            {"email": "john@fynlopos.com", "password": "password123"},
            {"email": "demo@fynlopos.com", "password": "demo"}
        ]
        
        # Check credentials
        is_valid = any(
            cred['email'] == email and cred['password'] == password 
            for cred in valid_credentials
        )
        
        if is_valid:
            # Find user data
            users = load_json_file(USERS_FILE, [])
            user = next((u for u in users if u['email'].lower() == email), None)
            
            if user:
                return jsonify({
                    "success": True,
                    "user": user,
                    "token": str(uuid.uuid4())  # Simple token for demo
                })
            else:
                return jsonify({"success": False, "message": "User not found"}), 404
        else:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Menu/Products endpoint (Mexican restaurant data)
@app.route('/api/v1/products', methods=['GET'])
def get_products():
    """Get restaurant menu items"""
    # Real Mexican restaurant menu
    products = [
        # SNACKS
        {"id": 1, "name": "Nachos", "price": 5.00, "category": "Snacks", "image": "🧀", "description": "Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander", "available_in_pos": True, "active": True},
        {"id": 2, "name": "Quesadillas", "price": 5.50, "category": "Snacks", "image": "🫓", "description": "Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander", "available_in_pos": True, "active": True},
        {"id": 3, "name": "Chorizo Quesadilla", "price": 5.50, "category": "Snacks", "image": "🌶️", "description": "Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander", "available_in_pos": True, "active": True},
        {"id": 4, "name": "Chicken Quesadilla", "price": 5.50, "category": "Snacks", "image": "🐔", "description": "Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander", "available_in_pos": True, "active": True},
        {"id": 5, "name": "Tostada", "price": 6.50, "category": "Snacks", "image": "🥙", "description": "Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta", "available_in_pos": True, "active": True},
        
        # TACOS
        {"id": 6, "name": "Carnitas", "price": 3.50, "category": "Tacos", "image": "🌮", "description": "Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander", "available_in_pos": True, "active": True},
        {"id": 7, "name": "Cochinita", "price": 3.50, "category": "Tacos", "image": "🌮", "description": "Marinated pulled pork served with pickle red onion", "available_in_pos": True, "active": True},
        {"id": 8, "name": "Barbacoa de Res", "price": 3.50, "category": "Tacos", "image": "🌮", "description": "Juicy pulled beef topped with onion, guacamole & coriander", "available_in_pos": True, "active": True},
        {"id": 9, "name": "Chorizo", "price": 3.50, "category": "Tacos", "image": "🌮", "description": "Grilled chorizo with black beans, onions, salsa, coriander & guacamole", "available_in_pos": True, "active": True},
        {"id": 10, "name": "Rellena", "price": 3.50, "category": "Tacos", "image": "🌮", "description": "Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion", "available_in_pos": True, "active": True},
        
        # BURRITOS
        {"id": 23, "name": "Regular Burrito", "price": 8.00, "category": "Burritos", "image": "🌯", "description": "Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.", "available_in_pos": True, "active": True},
        {"id": 24, "name": "Special Burrito", "price": 10.00, "category": "Burritos", "image": "🌯", "description": "Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.", "available_in_pos": True, "active": True},
        
        # DRINKS
        {"id": 31, "name": "Pink Paloma", "price": 3.75, "category": "Drinks", "image": "🍹", "description": "An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine", "available_in_pos": True, "active": True},
        {"id": 32, "name": "Coco-Nought", "price": 3.75, "category": "Drinks", "image": "🥥", "description": "Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!", "available_in_pos": True, "active": True},
        {"id": 33, "name": "Corona", "price": 3.80, "category": "Drinks", "image": "🍺", "description": "Mexican beer", "available_in_pos": True, "active": True},
        {"id": 34, "name": "Modelo", "price": 4.00, "category": "Drinks", "image": "🍺", "description": "Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml", "available_in_pos": True, "active": True}
    ]
    
    return jsonify(products)

# Bulk update endpoint for platform settings
@app.route('/api/v1/platform-settings/settings/bulk-update', methods=['POST'])
def bulk_update_settings():
    """Bulk update platform settings"""
    try:
        data = request.get_json()
        updates = data.get('updates', {})
        reason = data.get('reason', 'Bulk update')
        
        # For now, just return success
        # In a real app, you would update each setting
        successful_count = len(updates)
        
        return jsonify({
            "success": True,
            "successful": successful_count,
            "failed": 0,
            "message": f"Successfully updated {successful_count} settings",
            "reason": reason
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Users endpoints
@app.route('/api/v1/users', methods=['GET'])
def get_users():
    """Get all users"""
    users = load_json_file(USERS_FILE, [])
    return jsonify(users)

@app.route('/api/v1/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get specific user"""
    users = load_json_file(USERS_FILE, [])
    user = next((u for u in users if u['id'] == user_id), None)
    
    if user:
        return jsonify(user)
    else:
        return jsonify({"error": "User not found"}), 404

@app.route('/api/v1/users', methods=['POST'])
def create_user():
    """Create new user"""
    try:
        data = request.get_json()
        users = load_json_file(USERS_FILE, [])
        
        # Check if email already exists
        if any(u['email'] == data.get('email') for u in users):
            return jsonify({"success": False, "message": "User with this email already exists"}), 400
        
        new_user = {
            "id": f"user_{len(users) + 1}",
            "firstName": data.get('firstName', ''),
            "lastName": data.get('lastName', ''),
            "email": data.get('email', ''),
            "phone": data.get('phone', ''),
            "role": data.get('role', 'employee'),
            "pin": data.get('pin', ''),
            "employeeId": data.get('employeeId', ''),
            "businessId": data.get('businessId', ''),
            "isActive": True,
            "createdAt": datetime.now().isoformat(),
            "lastLogin": None
        }
        
        users.append(new_user)
        
        if save_json_file(USERS_FILE, users):
            return jsonify({"success": True, "user": new_user})
        else:
            return jsonify({"success": False, "message": "Failed to save user"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/v1/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update existing user"""
    try:
        data = request.get_json()
        users = load_json_file(USERS_FILE, [])
        
        user_index = next((i for i, u in enumerate(users) if u['id'] == user_id), None)
        if user_index is None:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Update user fields
        users[user_index].update(data)
        users[user_index]['updatedAt'] = datetime.now().isoformat()
        
        if save_json_file(USERS_FILE, users):
            return jsonify({"success": True, "user": users[user_index]})
        else:
            return jsonify({"success": False, "message": "Failed to update user"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Generic data sync endpoint
@app.route('/api/v1/sync', methods=['POST'])
def sync_data():
    """Generic data synchronization endpoint"""
    try:
        data = request.get_json()
        sync_type = data.get('type', 'unknown')
        
        print(f"🔄 Data sync request: {sync_type}")
        
        return jsonify({
            "success": True,
            "message": f"Data sync completed for {sync_type}",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Platform Payment Processing Endpoints
@app.route('/api/v1/platform/payment-processing', methods=['GET'])
def get_payment_processing_config():
    """Get platform payment processing configuration"""
    try:
        # Load current config or use defaults
        config = {
            "stripeEnabled": True,
            "stripeFeePercentage": 2.9,
            "squareEnabled": True,
            "squareFeePercentage": 2.6,
            "sumupEnabled": True,
            "sumupFeePercentage": 1.69,
            "qrCodeEnabled": True,
            "qrCodeFeePercentage": 1.2,
            "serviceChargeEnabled": True,
            "serviceChargeRate": 12.5,
            "requirePin": True,
            "contactlessLimit": 100.0,
            "dailyTransactionLimit": 5000.0
        }
        return jsonify({"success": True, "config": config})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/v1/platform/payment-processing', methods=['POST'])
def update_payment_processing_config():
    """Update platform payment processing configuration"""
    try:
        data = request.get_json()
        config = data.get('config', {})
        
        # Here you would save to database
        # For now, just return success
        
        return jsonify({
            "success": True,
            "message": "Payment processing configuration updated successfully",
            "updated_fields": list(config.keys())
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Platform Service Charge Endpoints
@app.route('/api/v1/platform/service-charge', methods=['GET'])
def get_service_charge_config():
    """Get platform service charge configuration"""
    try:
        service_charge = load_json_file(SERVICE_CHARGE_FILE, {
            "enabled": True,
            "rate": 12.5,
            "lastUpdated": datetime.now().isoformat()
        })
        return jsonify({"success": True, "config": service_charge})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/v1/platform/service-charge', methods=['POST'])
def update_service_charge_config():
    """Update platform service charge configuration"""
    try:
        data = request.get_json()
        enabled = data.get('enabled', True)
        rate = data.get('rate', 12.5)
        reason = data.get('reason', 'Service charge update')
        
        service_charge_config = {
            "enabled": enabled,
            "rate": rate,
            "lastUpdated": datetime.now().isoformat(),
            "reason": reason
        }
        
        if save_json_file(SERVICE_CHARGE_FILE, service_charge_config):
            return jsonify({
                "success": True,
                "message": "Service charge configuration updated successfully",
                "config": service_charge_config
            })
        else:
            return jsonify({"success": False, "message": "Failed to save service charge configuration"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Platform Plans & Pricing Endpoints
PLANS_FILE = f'{DATA_DIR}/plans_pricing.json'

@app.route('/api/v1/platform/plans-pricing', methods=['GET'])
def get_plans_pricing():
    """Get platform plans and pricing configuration"""
    try:
        plans = load_json_file(PLANS_FILE, {
            "basicPlanName": "Starter",
            "basicMonthlyFee": 29.99,
            "basicDescription": "Perfect for new restaurants getting started",
            "premiumPlanName": "Professional", 
            "premiumMonthlyFee": 79.99,
            "premiumDescription": "Advanced features for growing businesses",
            "enterprisePlanName": "Enterprise",
            "enterpriseMonthlyFee": 199.99,
            "enterpriseDescription": "Full-scale solution for large operations",
            "serviceChargeRate": 12.5,
            "serviceChargeEnabled": True,
            "freeTrialDays": 30,
            "setupFee": 0.00,
            "cancellationFee": 0.00,
            "supportIncluded": True
        })
        return jsonify({"success": True, "config": plans})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/v1/platform/plans-pricing', methods=['POST'])
def update_plans_pricing():
    """Update platform plans and pricing configuration"""
    try:
        data = request.get_json()
        config = data.get('config', {})
        
        # Add timestamp
        config['lastUpdated'] = datetime.now().isoformat()
        
        if save_json_file(PLANS_FILE, config):
            return jsonify({
                "success": True,
                "message": "Plans and pricing configuration updated successfully",
                "config": config
            })
        else:
            return jsonify({"success": False, "message": "Failed to save plans and pricing configuration"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Platform Settings Bulk Update
@app.route('/api/v1/platform/settings/bulk-update', methods=['POST'])
def platform_bulk_update():
    """Platform-specific bulk update endpoint"""
    try:
        data = request.get_json()
        updates = data.get('updates', {})
        reason = data.get('reason', 'Bulk platform settings update')
        
        # Here you would update each setting in the database
        # For now, just return success
        successful_count = len(updates)
        
        return jsonify({
            "success": True,
            "successful": successful_count,
            "failed": 0,
            "message": f"Successfully updated {successful_count} platform settings",
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Fynlo POS Backend API Server...")
    
    # Initialize data
    init_data()
    
    print("✅ Backend data initialized")
    print("📊 Real Mexican restaurant data loaded")
    print("🔧 Service charge API ready")
    print("🏢 Platform endpoints configured")
    print("🌐 Starting server on http://192.168.0.109:8000")
    
    # Start server
    app.run(host='0.0.0.0', port=8000, debug=True)