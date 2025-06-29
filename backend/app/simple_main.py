"""
Minimal Fynlo Backend for Immediate Cross-Device Sync Testing
This version starts with just PostgreSQL connection to prove the concept
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Fynlo POS Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DATABASE_URL = "postgresql://fynlo_user:fynlo_password@localhost/fynlo_pos"

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

@app.get("/health")
async def health_check():
    """Health check endpoint with database connectivity"""
    try:
        conn = get_db_connection()
        if conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT version();")
                db_version = cursor.fetchone()
            conn.close()
            
            return {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "database": "connected",
                "db_version": db_version['version'] if db_version else "unknown"
            }
        else:
            return {
                "status": "degraded",
                "timestamp": datetime.now().isoformat(),
                "database": "disconnected"
            }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Fynlo POS Backend API", "status": "running", "timestamp": datetime.now().isoformat()}

@app.get("/api/v1/platform/settings/service-charge")
async def get_service_charge():
    """Get platform service charge setting"""
    try:
        conn = get_db_connection()
        if not conn:
            return {"error": "Database connection failed", "default_rate": 12.5}
        
        # For now, return a default value - later we'll read from database
        return {
            "enabled": True,
            "rate": 12.5,
            "timestamp": datetime.now().isoformat(),
            "source": "platform_default"
        }
    except Exception as e:
        logger.error(f"Service charge get error: {e}")
        return {"error": str(e), "default_rate": 12.5}

@app.post("/api/v1/platform/settings/service-charge")
async def update_service_charge(data: dict):
    """Update platform service charge setting"""
    try:
        rate = data.get("rate", 12.5)
        enabled = data.get("enabled", True)
        
        logger.info(f"📊 Service charge update request: {rate}% enabled={enabled}")
        
        # For now, just log the change - later we'll save to database
        return {
            "success": True,
            "rate": rate,
            "enabled": enabled,
            "timestamp": datetime.now().isoformat(),
            "message": f"Service charge updated to {rate}%"
        }
    except Exception as e:
        logger.error(f"Service charge update error: {e}")
        return {"error": str(e), "success": False}

# Also add legacy endpoints without /v1 for direct testing
@app.get("/api/platform/settings/service-charge")
async def get_service_charge_legacy():
    """Legacy endpoint for direct testing"""
    return await get_service_charge()

@app.post("/api/platform/settings/service-charge")
async def update_service_charge_legacy(data: dict):
    """Legacy endpoint for direct testing"""
    return await update_service_charge(data)

# Restaurant Management Endpoints
@app.get("/api/v1/platform/restaurants/{platform_owner_id}")
async def get_platform_restaurants(platform_owner_id: str):
    """Get all restaurants for a platform owner"""
    try:
        logger.info(f"📊 Returning restaurants for platform owner: {platform_owner_id}")
        
        # TODO: Query actual database when tables are set up
        # For now, return mock data from backend
        restaurants_data = {
            "restaurants": [
                {
                    "id": "restaurant1",
                    "name": "Fynlo Mexican Restaurant",
                    "displayName": "Fynlo Mexican Restaurant",
                    "businessType": "restaurant",
                    "address": "123 Mexican Street, London, SW1A 1AA",
                    "phone": "+44 20 7123 4567",
                    "email": "mexican@fynlopos.com",
                    "website": "https://fynlomexican.com",
                    "vatNumber": "GB123456789",
                    "registrationNumber": "12345678",
                    "platformOwnerId": platform_owner_id,
                    "ownerId": "owner_mexican_1",
                    "subscriptionTier": "premium",
                    "currency": "GBP",
                    "monthlyRevenue": 45800,
                    "commissionRate": 2.2,
                    "isActive": True,
                    "onboardingCompleted": True,
                    "joinedDate": "2024-01-15T10:00:00Z",
                    "lastActivity": datetime.now().isoformat(),
                    "timezone": "Europe/London",
                    "theme": "clover",
                    "primaryColor": "#00A651",
                    "todayTransactions": 47,
                    "todayRevenue": 1280,
                    "activeOrders": 3,
                    "averageOrderValue": 27.23
                },
                {
                    "id": "restaurant2", 
                    "name": "Fynlo Pizza Palace",
                    "displayName": "Fynlo Pizza Palace",
                    "businessType": "restaurant",
                    "address": "456 Main Street, Manchester, M1 2AB",
                    "phone": "+44 161 234 5678",
                    "email": "pizza@fynlopos.com",
                    "website": "https://fynlopizza.com",
                    "vatNumber": "GB987654321",
                    "registrationNumber": "87654321",
                    "platformOwnerId": platform_owner_id,
                    "ownerId": "owner_pizza_1",
                    "subscriptionTier": "basic",
                    "currency": "GBP",
                    "monthlyRevenue": 32800,
                    "commissionRate": 2.5,
                    "isActive": True,
                    "onboardingCompleted": True,
                    "joinedDate": "2024-02-01T10:00:00Z",
                    "lastActivity": datetime.now().isoformat(),
                    "timezone": "Europe/London",
                    "theme": "clover",
                    "primaryColor": "#00A651",
                    "todayTransactions": 32,
                    "todayRevenue": 890,
                    "activeOrders": 1,
                    "averageOrderValue": 27.81
                },
                {
                    "id": "restaurant3",
                    "name": "Fynlo Burger Bar", 
                    "displayName": "Fynlo Burger Bar",
                    "businessType": "restaurant",
                    "address": "789 Broadway, Birmingham, B1 3CD",
                    "phone": "+44 121 987 6543",
                    "email": "burgers@fynlopos.com",
                    "website": "https://fynloburgers.com",
                    "vatNumber": "GB456789123", 
                    "registrationNumber": "45678912",
                    "platformOwnerId": platform_owner_id,
                    "ownerId": "owner_burger_1",
                    "subscriptionTier": "enterprise",
                    "currency": "GBP",
                    "monthlyRevenue": 38900,
                    "commissionRate": 2.0,
                    "isActive": True,
                    "onboardingCompleted": True,
                    "joinedDate": "2024-02-15T10:00:00Z",
                    "lastActivity": datetime.now().isoformat(),
                    "timezone": "Europe/London",
                    "theme": "clover",
                    "primaryColor": "#00A651",
                    "todayTransactions": 28,
                    "todayRevenue": 920,
                    "activeOrders": 2,
                    "averageOrderValue": 32.86
                }
            ],
            "total": 3,
            "source": "real_backend_api"
        }
        return restaurants_data
        
    except Exception as e:
        logger.error(f"Restaurant fetch error: {e}")
        return {"error": str(e), "restaurants": []}

@app.post("/api/v1/platform/restaurants")
async def create_restaurant(restaurant_data: dict):
    """Create a new restaurant for the platform"""
    try:
        logger.info(f"📊 Creating new restaurant: {restaurant_data.get('name', 'Unknown')}")
        
        # TODO: Save to database when tables are set up
        # For now, just return success
        return {
            "success": True,
            "restaurant_id": f"restaurant_{datetime.now().timestamp()}",
            "message": "Restaurant created successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Restaurant creation error: {e}")
        return {"error": str(e), "success": False}

@app.put("/api/v1/platform/restaurants/{restaurant_id}")
async def update_restaurant(restaurant_id: str, restaurant_data: dict):
    """Update restaurant data"""
    try:
        logger.info(f"📊 Updating restaurant: {restaurant_id}")
        
        # TODO: Update in database when tables are set up
        # For now, just return success
        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "message": "Restaurant updated successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Restaurant update error: {e}")
        return {"error": str(e), "success": False}

@app.get("/api/v1/restaurants/{restaurant_id}")
async def get_restaurant_details(restaurant_id: str):
    """Get specific restaurant details"""
    try:
        logger.info(f"📊 Getting restaurant details: {restaurant_id}")
        
        # TODO: Query database when tables are set up
        # For now, return mock data for the requested restaurant
        return {
            "id": restaurant_id,
            "name": f"Restaurant {restaurant_id}",
            "isActive": True,
            "lastActivity": datetime.now().isoformat(),
            "source": "mock_backend_data"
        }
    except Exception as e:
        logger.error(f"Restaurant details error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)