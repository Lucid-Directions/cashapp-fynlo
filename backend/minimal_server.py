#!/usr/bin/env python3
"""
Minimal Backend Server for Fynlo POS Testing
Provides essential endpoints without complex dependencies
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime

app = FastAPI(
    title="Fynlo POS - Minimal Server",
    description="Lightweight backend for testing",
    version="1.0.0"
)

# Enable CORS for frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Fynlo POS Minimal Server",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/v1/platform/service-charge")
async def get_service_charge():
    """Service charge configuration endpoint"""
    return {
        "success": True,
        "data": {
            "service_charge": {
                "enabled": True,
                "rate": 12.5,
                "description": "Platform service charge",
                "lastUpdated": datetime.now().isoformat()
            }
        }
    }

@app.post("/api/v1/platform/service-charge")
async def update_service_charge():
    """Update service charge configuration"""
    return {
        "success": True,
        "message": "Service charge updated successfully"
    }

@app.get("/api/v1/platform/payment-methods")
async def get_payment_methods():
    """Payment methods configuration endpoint"""
    return {
        "success": True,
        "data": {
            "payment_methods": [
                {
                    "id": "qr_code",
                    "name": "QR Code Payment",
                    "enabled": True,
                    "fee_percentage": 1.2
                },
                {
                    "id": "card",
                    "name": "Card Payment",
                    "enabled": True,
                    "fee_percentage": 2.9
                },
                {
                    "id": "cash",
                    "name": "Cash Payment",
                    "enabled": True,
                    "fee_percentage": 0.0
                }
            ]
        }
    }

@app.get("/api/v1/platform/settings")
async def get_platform_settings():
    """Platform settings endpoint"""
    return {
        "success": True,
        "data": {
            "platform": {
                "name": "Fynlo POS",
                "version": "1.0.0",
                "service_charge": {
                    "enabled": True,
                    "rate": 12.5
                },
                "payment_processing": {
                    "qr_enabled": True,
                    "card_enabled": True,
                    "cash_enabled": True
                }
            }
        }
    }

@app.post("/api/v1/auth/login")
async def login():
    """Authentication login endpoint"""
    return {
        "success": True,
        "data": {
            "access_token": "mock_jwt_token_123",
            "token_type": "bearer",
            "user": {
                "id": "1",
                "email": "demo@fynlopos.com",
                "role": "manager"
            }
        },
        "message": "Login successful"
    }

@app.post("/api/v1/auth/logout")
async def logout():
    """Authentication logout endpoint"""
    return {
        "success": True,
        "message": "Logout successful"
    }

@app.get("/api/v1/products/mobile")
async def get_products_mobile():
    """Mobile-optimized products endpoint"""
    return {
        "success": True,
        "data": [
            {
                "id": 1,
                "name": "Tacos al Pastor",
                "price": 8.50,
                "category": "Main Dishes",
                "image": "",
                "available_in_pos": True,
                "active": True
            },
            {
                "id": 2,
                "name": "Guacamole",
                "price": 6.00,
                "category": "Appetizers", 
                "image": "",
                "available_in_pos": True,
                "active": True
            }
        ]
    }

@app.get("/api/v1/categories")
async def get_categories():
    """Product categories endpoint"""
    return {
        "success": True,
        "data": [
            {"id": 1, "name": "Main Dishes", "active": True},
            {"id": 2, "name": "Appetizers", "active": True},
            {"id": 3, "name": "Beverages", "active": True}
        ]
    }

@app.post("/api/v1/orders")
async def create_order():
    """Create order endpoint"""
    return {
        "success": True,
        "data": {
            "id": 1001,
            "state": "draft",
            "amount_total": 14.50,
            "date_order": datetime.now().isoformat()
        },
        "message": "Order created successfully"
    }

@app.post("/api/v1/payments/process")
async def process_payment():
    """Payment processing endpoint"""
    return {
        "success": True,
        "data": {
            "payment_id": "pay_123",
            "provider": "stripe",
            "amount": 14.50,
            "fee": 0.42,
            "net_amount": 14.08,
            "status": "completed"
        },
        "message": "Payment processed successfully"
    }

# ===== INVENTORY MANAGEMENT ENDPOINTS =====

@app.get("/api/v1/inventory/items")
async def get_inventory_items():
    """Get all inventory items with pagination support"""
    return {
        "success": True,
        "data": [
            {
                "sku": "FLOUR_001",
                "name": "Plain Flour",
                "description": "White plain flour for general cooking",
                "qty_g": 5000,
                "par_level_g": 10000,
                "unit": "g",
                "cost_per_unit": 0.002,
                "supplier": "Local Supplier Ltd",
                "waste_pct": 2.5,
                "category": "Pantry",
                "last_updated": datetime.now().isoformat()
            },
            {
                "sku": "TOMATO_002",
                "name": "Fresh Tomatoes",
                "description": "Organic Roma tomatoes",
                "qty_g": 3500,
                "par_level_g": 5000,
                "unit": "g",
                "cost_per_unit": 0.004,
                "supplier": "Fresh Produce Co",
                "waste_pct": 10.0,
                "category": "Vegetables",
                "last_updated": datetime.now().isoformat()
            },
            {
                "sku": "CHEESE_003",
                "name": "Mozzarella Cheese",
                "description": "Fresh mozzarella for pizzas and dishes",
                "qty_g": 2000,
                "par_level_g": 3000,
                "unit": "g",
                "cost_per_unit": 0.012,
                "supplier": "Dairy Fresh Ltd",
                "waste_pct": 5.0,
                "category": "Dairy",
                "last_updated": datetime.now().isoformat()
            }
        ]
    }

@app.get("/api/v1/inventory/items/{sku}")
async def get_inventory_item(sku: str):
    """Get specific inventory item by SKU"""
    return {
        "success": True,
        "data": {
            "sku": sku,
            "name": "Plain Flour",
            "description": "White plain flour for general cooking",
            "qty_g": 5000,
            "par_level_g": 10000,
            "unit": "g",
            "cost_per_unit": 0.002,
            "supplier": "Local Supplier Ltd",
            "waste_pct": 2.5,
            "category": "Pantry",
            "last_updated": datetime.now().isoformat()
        }
    }

@app.post("/api/v1/inventory/items")
async def create_inventory_item():
    """Create new inventory item"""
    return {
        "success": True,
        "data": {
            "sku": "NEW_ITEM_001",
            "name": "New Inventory Item",
            "description": "Newly created item",
            "qty_g": 1000,
            "par_level_g": 2000,
            "unit": "g",
            "cost_per_unit": 0.005,
            "supplier": "Default Supplier",
            "waste_pct": 0.0,
            "category": "General",
            "last_updated": datetime.now().isoformat()
        },
        "message": "Inventory item created successfully"
    }

@app.put("/api/v1/inventory/items/{sku}")
async def update_inventory_item(sku: str):
    """Update existing inventory item"""
    return {
        "success": True,
        "data": {
            "sku": sku,
            "name": "Updated Item Name",
            "description": "Updated description",
            "qty_g": 6000,
            "par_level_g": 12000,
            "unit": "g",
            "cost_per_unit": 0.003,
            "supplier": "Updated Supplier",
            "waste_pct": 3.0,
            "category": "Updated Category",
            "last_updated": datetime.now().isoformat()
        },
        "message": "Inventory item updated successfully"
    }

@app.delete("/api/v1/inventory/items/{sku}")
async def delete_inventory_item(sku: str):
    """Soft delete inventory item (sets active=false)"""
    return {
        "success": True,
        "data": {
            "sku": sku,
            "active": False,
            "deleted_at": datetime.now().isoformat()
        },
        "message": "Inventory item deactivated successfully"
    }

@app.post("/api/v1/inventory/items/{sku}/adjust-stock")
async def adjust_stock(sku: str):
    """Adjust stock levels for an inventory item"""
    return {
        "success": True,
        "data": {
            "sku": sku,
            "previous_qty_g": 5000,
            "change_qty_g": 2000,
            "new_qty_g": 7000,
            "reason": "receipt_scan_import",
            "timestamp": datetime.now().isoformat(),
            "movement_id": "mov_" + str(datetime.now().timestamp())
        },
        "message": "Stock adjusted successfully"
    }

@app.get("/api/v1/inventory/ledger")
async def get_inventory_ledger():
    """Get inventory movement history"""
    return {
        "success": True,
        "data": [
            {
                "id": 1,
                "sku": "FLOUR_001",
                "delta_g": 2000,
                "source": "receipt_scan",
                "source_id": "receipt_001",
                "reason": "Stock replenishment from supplier",
                "ts": datetime.now().isoformat(),
                "user_id": "user_123"
            },
            {
                "id": 2,
                "sku": "TOMATO_002",
                "delta_g": -500,
                "source": "order_completion",
                "source_id": "order_456",
                "reason": "Used in completed order",
                "ts": datetime.now().isoformat(),
                "user_id": "system"
            }
        ]
    }

@app.get("/api/v1/inventory/ledger/{sku}")
async def get_inventory_ledger_by_sku(sku: str):
    """Get inventory movement history for specific SKU"""
    return {
        "success": True,
        "data": [
            {
                "id": 1,
                "sku": sku,
                "delta_g": 2000,
                "source": "receipt_scan",
                "source_id": "receipt_001",
                "reason": "Stock replenishment from supplier",
                "ts": datetime.now().isoformat(),
                "user_id": "user_123"
            }
        ]
    }

@app.post("/api/v1/inventory/scan-receipt")
async def scan_receipt():
    """OCR receipt processing endpoint"""
    return {
        "success": True,
        "data": [
            {
                "name": "Plain Flour",
                "quantity": 5.0,
                "price": 10.00,
                "sku_match": "FLOUR_001",
                "confidence": 0.95,
                "raw_text_name": "PLAIN FLOUR 5KG",
                "raw_text_quantity": "5KG",
                "raw_text_price": "£10.00"
            },
            {
                "name": "Fresh Tomatoes",
                "quantity": 2.0,
                "price": 8.00,
                "sku_match": "TOMATO_002",
                "confidence": 0.88,
                "raw_text_name": "TOMATOES FRESH 2KG",
                "raw_text_quantity": "2KG", 
                "raw_text_price": "£8.00"
            },
            {
                "name": "Unknown Item",
                "quantity": 1.0,
                "price": 5.50,
                "sku_match": None,
                "confidence": 0.75,
                "raw_text_name": "UNKNOWN PRODUCT",
                "raw_text_quantity": "1",
                "raw_text_price": "£5.50"
            }
        ],
        "message": "Receipt processed successfully"
    }

# ===== RECIPE & MENU INTEGRATION ENDPOINTS =====

@app.get("/api/v1/recipes")
async def get_recipes():
    """Get all recipes with ingredients"""
    return {
        "success": True,
        "data": [
            {
                "item_id": "menu_001",
                "item_name": "Margherita Pizza",
                "ingredients": [
                    {
                        "ingredient_sku": "FLOUR_001",
                        "ingredient_name": "Plain Flour",
                        "qty_g": 300,
                        "ingredient_unit": "g"
                    },
                    {
                        "ingredient_sku": "TOMATO_002", 
                        "ingredient_name": "Fresh Tomatoes",
                        "qty_g": 150,
                        "ingredient_unit": "g"
                    },
                    {
                        "ingredient_sku": "CHEESE_003",
                        "ingredient_name": "Mozzarella Cheese", 
                        "qty_g": 200,
                        "ingredient_unit": "g"
                    }
                ]
            }
        ]
    }

@app.get("/api/v1/recipes/{item_id}")
async def get_recipe_by_item(item_id: str):
    """Get recipe for specific menu item"""
    return {
        "success": True,
        "data": {
            "item_id": item_id,
            "item_name": "Margherita Pizza",
            "ingredients": [
                {
                    "ingredient_sku": "FLOUR_001",
                    "ingredient_name": "Plain Flour",
                    "qty_g": 300,
                    "ingredient_unit": "g"
                },
                {
                    "ingredient_sku": "TOMATO_002",
                    "ingredient_name": "Fresh Tomatoes", 
                    "qty_g": 150,
                    "ingredient_unit": "g"
                }
            ]
        }
    }

@app.post("/api/v1/recipes")
async def create_or_update_recipe():
    """Create or update recipe for menu item"""
    return {
        "success": True,
        "data": [
            {
                "ingredient_sku": "FLOUR_001",
                "qty_g": 300
            },
            {
                "ingredient_sku": "TOMATO_002", 
                "qty_g": 150
            }
        ],
        "message": "Recipe created/updated successfully"
    }

@app.delete("/api/v1/recipes/{item_id}")
async def delete_recipe(item_id: str):
    """Delete recipe for menu item"""
    return {
        "success": True,
        "message": f"Recipe for item {item_id} deleted successfully"
    }

# ===== WASTE TRACKING & COST CALCULATION ENDPOINTS =====

@app.get("/api/v1/inventory/cost-analysis")
async def get_cost_analysis():
    """Get cost analysis including waste calculations"""
    return {
        "success": True,
        "data": {
            "total_inventory_value": 25500.75,
            "total_waste_cost": 1275.50,
            "waste_percentage": 5.0,
            "monthly_cogs": 12000.00,
            "items_analysis": [
                {
                    "sku": "FLOUR_001",
                    "name": "Plain Flour",
                    "inventory_value": 10.00,
                    "waste_cost": 0.25,
                    "waste_percentage": 2.5,
                    "monthly_usage_cost": 450.00
                },
                {
                    "sku": "TOMATO_002",
                    "name": "Fresh Tomatoes",
                    "inventory_value": 14.00,
                    "waste_cost": 1.40,
                    "waste_percentage": 10.0,
                    "monthly_usage_cost": 320.00
                }
            ]
        }
    }

@app.post("/api/v1/inventory/items/{sku}/waste")
async def update_waste_percentage(sku: str):
    """Update waste percentage for inventory item"""
    return {
        "success": True,
        "data": {
            "sku": sku,
            "previous_waste_pct": 5.0,
            "new_waste_pct": 7.5,
            "updated_at": datetime.now().isoformat()
        },
        "message": "Waste percentage updated successfully"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Fynlo POS Backend Server...")
    print("📡 Network Configuration:")
    print("   • Host: 0.0.0.0 (accepting all network interfaces)")
    print("   • Port: 8000")
    print("   • LAN Access: http://192.168.68.101:8000")
    print("   • Local Access: http://localhost:8000")
    print("   • Health Check: /health")
    print("🔧 CORS: Enabled for all origins")
    
    # Bind to 0.0.0.0 to accept all connections
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000, 
        log_level="info",
        access_log=True
    )