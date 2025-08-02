"""
Onboarding Helper for Fynlo POS
Handles API responses for users without restaurants
"""

from typing import Optional, Dict, Any
from app.core.responses import APIResponseHelper
from app.core.database import User


class OnboardingHelper:
    """Helper class for handling onboarding users gracefully"""
    
    @staticmethod
    def check_onboarding_required(user: Optional[User]) -> bool:
        """Check if user needs onboarding"""
        if not user:
            return False
        return not user.restaurant_id
    
    @staticmethod
    def get_empty_response(resource_type: str) -> Dict[str, Any]:
        """Get appropriate empty response for onboarding users"""
        
        responses = {
            "menu_items": {
                "data": [],
                "message": "Complete onboarding to add menu items",
                "onboarding_required": True
            },
            "orders": {
                "data": [],
                "message": "No orders yet - complete onboarding to start taking orders",
                "onboarding_required": True
            },
            "reports": {
                "data": {
                    "total_sales": 0,
                    "total_orders": 0,
                    "average_order_value": 0
                },
                "message": "Complete onboarding to view reports",
                "onboarding_required": True
            },
            "employees": {
                "data": [],
                "message": "Add employees during onboarding",
                "onboarding_required": True
            },
            "tables": {
                "data": [],
                "message": "Set up tables after completing onboarding",
                "onboarding_required": True
            },
            "inventory": {
                "data": [],
                "message": "Inventory management available after onboarding",
                "onboarding_required": True
            },
            "settings": {
                "data": {
                    "restaurant": None,
                    "preferences": {},
                    "features": []
                },
                "message": "Complete onboarding to configure settings",
                "onboarding_required": True
            }
        }
        
        return responses.get(resource_type, {
            "data": None,
            "message": "Please complete onboarding to access this feature",
            "onboarding_required": True
        })
    
    @staticmethod
    def handle_onboarding_response(user: Optional[User], resource_type: str, 
                                   endpoint_requires_restaurant: bool = True):
        """
        Handle API response for onboarding users
        
        Args:
            user: Current user
            resource_type: Type of resource being accessed
            endpoint_requires_restaurant: Whether endpoint absolutely requires restaurant
            
        Returns:
            APIResponse or None (if user has restaurant)
        """
        if not user:
            return APIResponseHelper.error(
                message="Authentication required",
                status_code=401
            )
        
        if user.restaurant_id:
            # User has restaurant, proceed normally
            return None
        
        if endpoint_requires_restaurant:
            # Endpoint requires restaurant but user doesn't have one
            empty_response = OnboardingHelper.get_empty_response(resource_type)
            return APIResponseHelper.success(
                data=empty_response.get("data"),
                message=empty_response.get("message"),
                extra_fields={"onboarding_required": True}
            )
        
        # Endpoint doesn't require restaurant, proceed normally
        return None
    
    @staticmethod
    def get_onboarding_tips(current_step: int) -> Dict[str, Any]:
        """Get helpful tips for current onboarding step"""
        
        tips = {
            1: {
                "title": "Restaurant Information",
                "tips": [
                    "Choose a clear, memorable restaurant name",
                    "Select the business type that best describes your establishment",
                    "The display name will appear on receipts and the POS interface"
                ]
            },
            2: {
                "title": "Contact Details",
                "tips": [
                    "Provide accurate contact information for customer inquiries",
                    "This email will receive important platform notifications",
                    "Include country code for international phone numbers"
                ]
            },
            3: {
                "title": "Location",
                "tips": [
                    "Enter your complete address for delivery services",
                    "Accurate location helps with local SEO",
                    "This address appears on customer receipts"
                ]
            },
            4: {
                "title": "Owner Information",
                "tips": [
                    "Owner details are kept private and secure",
                    "Used for account recovery and important communications",
                    "Required for legal and tax purposes"
                ]
            },
            5: {
                "title": "Business Hours",
                "tips": [
                    "Set accurate hours for each day of the week",
                    "You can update these anytime from settings",
                    "Consider peak hours when setting schedules"
                ]
            },
            6: {
                "title": "Team Setup",
                "tips": [
                    "Add key team members who will use the POS",
                    "Set appropriate access levels for security",
                    "You can add more employees later"
                ]
            },
            7: {
                "title": "Menu Creation",
                "tips": [
                    "Start with your most popular items",
                    "Organize items into logical categories",
                    "You can add photos and descriptions later"
                ]
            },
            8: {
                "title": "Payment Details",
                "tips": [
                    "Enter bank details to receive payments",
                    "All information is encrypted and secure",
                    "Payments are processed weekly on Fridays"
                ]
            },
            9: {
                "title": "Review & Launch",
                "tips": [
                    "Review all information carefully",
                    "You can edit details later in settings",
                    "After completion, you're ready to take orders!"
                ]
            }
        }
        
        return tips.get(current_step, {
            "title": "Getting Started",
            "tips": ["Complete each step to set up your restaurant"]
        })