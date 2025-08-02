"""
API Response Helper for Fynlo POS
Standardizes API responses across the application
"""

from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from fastapi import status
from fastapi.responses import JSONResponse


class APIResponseHelper:
    """Helper class for creating standardized API responses"""

    @staticmethod
    def success(data: Any = None, message: str = "Success", status_code: int = 200) -> JSONResponse:
        """
        Create a successful API response
        
        Args:
            data: The response data
            message: Success message
            status_code: HTTP status code
            meta: Additional metadata
            
        Returns:
            JSONResponse with standardized format
        """
        response = {
            "success": True,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if data is not None:
            response["data"] = data
            
        if meta:
            response["meta"] = meta
            
        return JSONResponse(
            content=response,
            status_code=status_code
        )

    @staticmethod
    def error(
        message: str = "An error occurred",
        status_code: int = 400,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """
        Create an error API response
        
        Args:
            message: Error message
            status_code: HTTP status code
            error_code: Application-specific error code
            details: Additional error details
            
        Returns:
            JSONResponse with standardized error format
        """
        response = {
            "success": False,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if error_code:
            response["error_code"] = error_code
            
        if details:
            response["details"] = details
            
        return JSONResponse(
            content=response,
            status_code=status_code
        )

    @staticmethod
    def paginated(data: List[Any], page: int = 1, page_size: int = 20, total: Optional[int] = None, message: str = "Success", meta: Optional[Dict[str, Any]] = None) -> JSONResponse:
        """
        Create a paginated API response
        
        Args:
            data: List of items for current page
            page: Current page number
            page_size: Items per page
            total: Total number of items
            message: Success message
            
        Returns:
            JSONResponse with pagination metadata
        """
        total_pages = (total + page_size - 1) // page_size
        
        return APIResponseHelper.success(
            data=data,
            message=message,
            meta={
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                }
            }
        )

    @staticmethod
    def needs_onboarding(user_data: Dict[str, Any], message: str = "Please complete onboarding to continue") -> JSONResponse:
        """
        Create response for users who need to complete onboarding
        
        Args:
            user_data: Basic user information
            message: Onboarding message
            
        Returns:
            JSONResponse indicating onboarding is required
        """
        return JSONResponse(
            content={
                "success": False,
                "requires_onboarding": True,
                "message": message,
                "user": user_data,
                "timestamp": datetime.utcnow().isoformat(),
            },
            status_code=status.HTTP_403_FORBIDDEN
        )