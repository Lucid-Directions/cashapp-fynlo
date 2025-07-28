"""
Minimal FastAPI app for DigitalOcean deployment
No external dependencies, immediate startup
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Create minimal FastAPI app
app = FastAPI(
    title="Fynlo POS Backend",
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Fynlo POS Backend API",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "message": "Fynlo POS API is running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for DigitalOcean"""
    return {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "environment": os.environ.get("ENVIRONMENT", "production"),
        "port": os.environ.get("PORT", "8080")
    }

@app.get("/api/v1/health")
async def api_health():
    """API health check"""
    return {
        "api_version": "v1",
        "status": "operational",
        "endpoints": "available",
        "timestamp": datetime.now().isoformat()
    }

# Authentication endpoints
@app.post("/api/v1/auth/login")
async def login(request: dict):
    """Authentication endpoint with mock data"""
    email = request.get("email", "").lower()
    password = request.get("password", "")
    
    # Mock credentials for quick testing
    mock_credentials = {
        "owner@fynlopos.com": "platformowner123",
        "restaurant_owner": "owner123",
        "platform_owner": "platform123", 
        "manager": "manager123",
        "cashier": "cashier123",
        "john@fynlopos.com": "password123",
        "demo@fynlopos.com": "demo"
    }
    
    if email in mock_credentials and mock_credentials[email] == password:
        # Return successful authentication
        return {
            "success": True,
            "data": {
                "access_token": "mock_token_12345",
                "token_type": "bearer",
                "user": {
                    "id": "user_123",
                    "email": email,
                    "role": "platform_owner" if "platform" in email else "restaurant_owner",
                    "firstName": "Test",
                    "lastName": "User"
                }
            },
            "message": "Authentication successful",
            "timestamp": datetime.now().isoformat()
        }
    else:
        return {
            "success": False,
            "error": "Invalid credentials",
            "message": "Authentication failed",
            "timestamp": datetime.now().isoformat()
        }

# Menu endpoints
@app.get("/api/v1/menu/items")
async def get_menu_items():
    """Get menu items"""
    return {
        "success": True,
        "data": [
            {"id": 1, "name": "Tacos", "price": 8.99, "category": "Main"},
            {"id": 2, "name": "Burrito", "price": 12.99, "category": "Main"},
            {"id": 3, "name": "Nachos", "price": 9.99, "category": "Appetizer"}
        ],
        "message": "Menu items retrieved",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/menu/categories")
async def get_menu_categories():
    """Get menu categories"""
    return {
        "success": True,
        "data": [
            {"id": 1, "name": "Main", "description": "Main courses"},
            {"id": 2, "name": "Appetizer", "description": "Appetizers"},
            {"id": 3, "name": "Beverage", "description": "Drinks"}
        ],
        "message": "Menu categories retrieved",
        "timestamp": datetime.now().isoformat()
    }

# Employee endpoints
@app.get("/api/v1/employees")
async def get_employees():
    """Get employees"""
    return {
        "success": True,
        "data": [
            {
                "id": 1,
                "name": "John Manager",
                "email": "john@restaurant.com",
                "role": "manager",
                "hourlyRate": 25.00,
                "totalSales": 15420.50,
                "performanceScore": 9.2,
                "isActive": True
            },
            {
                "id": 2,
                "name": "Sarah Cashier", 
                "email": "sarah@restaurant.com",
                "role": "cashier",
                "hourlyRate": 15.50,
                "totalSales": 8750.25,
                "performanceScore": 8.8,
                "isActive": True
            }
        ],
        "message": "Employees retrieved",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting Fynlo POS Backend on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)