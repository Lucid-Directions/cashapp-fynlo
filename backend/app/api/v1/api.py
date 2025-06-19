"""
API Router for Fynlo POS Backend
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, restaurants, products, orders, payments, customers, analytics, files, platform, websocket

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(files.router, prefix="/files", tags=["file_upload"])
api_router.include_router(platform.router, prefix="/platform", tags=["platform"])
api_router.include_router(websocket.router, prefix="/websocket", tags=["websocket"])