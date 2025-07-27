"""
Debug endpoint to associate user with restaurant
TEMPORARY - Remove in production
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()

@router.post("/debug/associate-restaurant")
async def associate_user_with_restaurant(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Associate current user with a restaurant (DEBUG ONLY)"""
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    try:
        # Check if user already has a restaurant
        result = db.execute(
            text("SELECT restaurant_id FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        ).fetchone()
        
        if result and result[0]:
            return {"message": "User already has a restaurant", "restaurant_id": str(result[0])}
        
        # Find or create a restaurant
        restaurant = db.execute(
            text("SELECT id, name FROM restaurants LIMIT 1")
        ).fetchone()
        
        if not restaurant:
            # Create a test restaurant
            new_restaurant_id = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO restaurants (
                        id, name, legal_name, address, city, postal_code,
                        country, phone, email, vat_number, vat_rate,
                        currency, timezone, is_active, created_at, updated_at
                    ) VALUES (
                        :id, :name, :legal_name, :address, :city, :postal_code,
                        :country, :phone, :email, :vat_number, :vat_rate,
                        :currency, :timezone, :is_active, :created_at, :updated_at
                    )
                """),
                {
                    "id": new_restaurant_id,
                    "name": "Fynlo Test Restaurant",
                    "legal_name": "Fynlo Test Restaurant Ltd",
                    "address": "123 Test Street",
                    "city": "London",
                    "postal_code": "SW1A 1AA",
                    "country": "UK",
                    "phone": "+44 20 1234 5678",
                    "email": "test@fynlo.com",
                    "vat_number": "GB123456789",
                    "vat_rate": 20.0,
                    "currency": "GBP",
                    "timezone": "Europe/London",
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            )
            restaurant_id = new_restaurant_id
            restaurant_name = "Fynlo Test Restaurant"
        else:
            restaurant_id = str(restaurant[0])
            restaurant_name = restaurant[1]
        
        # Associate user with restaurant
        db.execute(
            text("UPDATE users SET restaurant_id = :restaurant_id WHERE id = :user_id"),
            {"restaurant_id": restaurant_id, "user_id": user_id}
        )
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Successfully associated user with restaurant: {restaurant_name}",
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant_name
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))