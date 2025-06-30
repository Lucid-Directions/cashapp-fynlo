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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)