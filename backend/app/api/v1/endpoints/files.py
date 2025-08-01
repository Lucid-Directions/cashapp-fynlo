"""
File Upload API endpoints for Fynlo POS
iOS-optimized base64 image upload endpoints
"""TODO: Add docstring."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os

from app.core.database import get_db, Product, Restaurant, User
from app.core.auth import get_current_user
from app.core.file_upload import file_upload_service, ImageUploadRequest, ImageUploadResponse
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes

router = APIRouter()

# Product Image Upload Models
class ProductImageUpload(BaseModel):
    """Product image upload request"""
    image_data: str  # Base64 encoded image
    alt_text: Optional[str] = None
    filename: Optional[str] = None

class RestaurantLogoUpload(BaseModel):
    """Restaurant logo upload request"""
    image_data: str  # Base64 encoded image
    alt_text: Optional[str] = None
    filename: Optional[str] = None

class FileUploadResponse(BaseModel):
    """Standardized file upload response"""
    file_id: str
    original_url: str
    thumbnail_url: Optional[str]
    variants: dict
    metadata: dict

# Product Image Endpoints
@router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: str = Path(..., description="Product ID"),
    upload_data: ProductImageUpload = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload base64 image for a product (iOS optimized)
    
    This endpoint accepts base64 encoded images from mobile devices
    and generates multiple size variants for optimal mobile performance.
    """
    try:
        # Verify product exists and user has access
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise FynloException(
                message="Product not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Check permissions
        if str(product.restaurant_id) != str(current_user.restaurant_id):
            if current_user.role != "platform_owner":
                raise FynloException(
                    message="Access denied - not your restaurant's product",
                    error_code=ErrorCodes.FORBIDDEN,
                    status_code=403
                )
        
        # Upload image
        upload_result = await file_upload_service.upload_base64_image(
            base64_data=upload_data.image_data,
            upload_type="product",
            filename=upload_data.filename or f"product_{product.name}",
            generate_variants=True
        )
        
        # Update product with image URL
        product.image_url = upload_result.original_url
        db.commit()
        
        return APIResponseHelper.success(
            data=FileUploadResponse(
                file_id=upload_result.file_id,
                original_url=upload_result.original_url,
                thumbnail_url=upload_result.thumbnail_url,
                variants=upload_result.variants,
                metadata=upload_result.metadata
            ).dict(),
            message="Product image uploaded successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Product image upload failed: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/products/{product_id}/image")
async def get_product_image(
    product_id: str = Path(..., description="Product ID"),
    size: Optional[str] = Query("original", description="Image size variant"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get product image URL with size variants
    """
    try:
        # Verify product exists
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise FynloException(
                message="Product not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        if not product.image_url:
            raise FynloException(
                message="Product has no image",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # For size variants, we'd need to store metadata in database
        # For now, return the original URL
        image_data = {
            "original_url": product.image_url,
            "product_id": str(product.id),
            "product_name": product.name
        }
        
        return APIResponseHelper.success(
            data=image_data,
            message="Product image retrieved successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve product image: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.delete("/products/{product_id}/image")
async def delete_product_image(
    product_id: str = Path(..., description="Product ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete product image
    """
    try:
        # Verify product exists and user has access
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise FynloException(
                message="Product not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Check permissions
        if str(product.restaurant_id) != str(current_user.restaurant_id):
            if current_user.role != "platform_owner":
                raise FynloException(
                    message="Access denied",
                    error_code=ErrorCodes.FORBIDDEN,
                    status_code=403
                )
        
        if not product.image_url:
            raise FynloException(
                message="Product has no image to delete",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Extract file_id from URL (simplified - in production you'd store this)
        # For now, just clear the URL
        product.image_url = None
        db.commit()
        
        return APIResponseHelper.success(
            message="Product image deleted successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to delete product image: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Restaurant Logo Endpoints
@router.post("/restaurants/{restaurant_id}/logo")
async def upload_restaurant_logo(
    restaurant_id: str = Path(..., description="Restaurant ID"),
    upload_data: RestaurantLogoUpload = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload base64 logo for a restaurant (iOS optimized)
    """
    try:
        # Verify restaurant exists and user has access
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if not restaurant:
            raise FynloException(
                message="Restaurant not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Check permissions
        if current_user.role == "platform_owner":
            # Platform owners can update any restaurant in their platform
            if str(restaurant.platform_id) != str(current_user.platform_id):
                raise FynloException(
                    message="Access denied - not your platform's restaurant",
                    error_code=ErrorCodes.FORBIDDEN,
                    status_code=403
                )
        else:
            # Restaurant users can only update their own restaurant
            if str(restaurant.id) != str(current_user.restaurant_id):
                raise FynloException(
                    message="Access denied - not your restaurant",
                    error_code=ErrorCodes.FORBIDDEN,
                    status_code=403
                )
        
        # Upload logo
        upload_result = await file_upload_service.upload_base64_image(
            base64_data=upload_data.image_data,
            upload_type="restaurant",
            filename=upload_data.filename or f"logo_{restaurant.name}",
            generate_variants=True
        )
        
        # Update restaurant settings with logo URL
        if not restaurant.settings:
            restaurant.settings = {}
        
        restaurant.settings["logo_url"] = upload_result.original_url
        restaurant.settings["logo_variants"] = upload_result.variants
        db.commit()
        
        return APIResponseHelper.success(
            data=FileUploadResponse(
                file_id=upload_result.file_id,
                original_url=upload_result.original_url,
                thumbnail_url=upload_result.thumbnail_url,
                variants=upload_result.variants,
                metadata=upload_result.metadata
            ).dict(),
            message="Restaurant logo uploaded successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Restaurant logo upload failed: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

@router.get("/restaurants/{restaurant_id}/logo")
async def get_restaurant_logo(
    restaurant_id: str = Path(..., description="Restaurant ID"),
    size: Optional[str] = Query("original", description="Logo size variant"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get restaurant logo URL with size variants
    """
    try:
        # Verify restaurant exists
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if not restaurant:
            raise FynloException(
                message="Restaurant not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        logo_url = restaurant.settings.get("logo_url") if restaurant.settings else None
        if not logo_url:
            raise FynloException(
                message="Restaurant has no logo",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        logo_variants = restaurant.settings.get("logo_variants", {}) if restaurant.settings else {}
        
        logo_data = {
            "original_url": logo_url,
            "variants": logo_variants,
            "restaurant_id": str(restaurant.id),
            "restaurant_name": restaurant.name
        }
        
        return APIResponseHelper.success(
            data=logo_data,
            message="Restaurant logo retrieved successfully"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve restaurant logo: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# File Serving Endpoint
@router.get("/files/{file_type}/{filename}")
async def serve_file(
    file_type: str = Path(..., description="File type (products, restaurants, etc.)"),
    filename: str = Path(..., description="Filename")
):
    """
    Serve uploaded files with proper caching headers
    """
    try:
        # Map file types to directories
        type_dirs = {
            'products': 'products',
            'restaurants': 'restaurants', 
            'receipts': 'receipts',
            'profiles': 'profiles'
        }
        
        if file_type not in type_dirs:
            raise FynloException(
                message="Invalid file type",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Construct file path
        file_path = os.path.join("uploads", type_dirs[file_type], filename)
        
        if not os.path.exists(file_path):
            raise FynloException(
                message="File not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Serve file with caching headers
        return FileResponse(
            path=file_path,
            headers={
                "Cache-Control": "max-age=3600",  # Cache for 1 hour
                "ETag": f'"{os.path.getmtime(file_path)}"'
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to serve file: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Batch Upload Endpoint (for multiple images)
@router.post("/batch-upload")
async def batch_upload_images(
    upload_requests: list[ImageUploadRequest],
    upload_type: str = Query("product", description="Upload type (product, restaurant, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Batch upload multiple images (iOS optimized)
    """
    try:
        if len(upload_requests) > 10:
            raise FynloException(
                message="Maximum 10 images per batch upload",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        results = []
        for i, upload_request in enumerate(upload_requests):
            try:
                upload_result = await file_upload_service.upload_base64_image(
                    base64_data=upload_request.image_data,
                    upload_type=upload_type,
                    filename=upload_request.filename or f"batch_{i}",
                    generate_variants=upload_request.generate_thumbnails
                )
                
                results.append({
                    "success": True,
                    "index": i,
                    "file_id": upload_result.file_id,
                    "original_url": upload_result.original_url,
                    "thumbnail_url": upload_result.thumbnail_url,
                    "variants": upload_result.variants
                })
                
            except Exception as e:
                results.append({
                    "success": False,
                    "index": i,
                    "error": str(e)
                })
        
        return APIResponseHelper.success(
            data={
                "results": results,
                "total": len(upload_requests),
                "successful": sum(1 for r in results if r["success"]),
                "failed": sum(1 for r in results if not r["success"])
            },
            message="Batch upload completed"
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Batch upload failed: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )