"""
File Upload System for Fynlo POS
Handles base64 image uploads from iOS with validation and processing
"""

import base64
import os
import uuid
import logging
# Import python-magic with proper error handling
try:
    import magic
    MAGIC_AVAILABLE = True
except (ImportError, OSError):
    # This should not happen with python-magic-bin, but keep fallback for safety
    MAGIC_AVAILABLE = False
from typing import Optional, Tuple
from PIL import Image, ImageOps
from io import BytesIO
from datetime import datetime
from pydantic import BaseModel

from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import 
from app.core.config import settings

logger = logging.getLogger(__name__)

class FileUploadConfig:
    """Configuration for file uploads"""
    
    # Storage paths
    UPLOAD_DIR = "uploads"
    PRODUCT_IMAGES_DIR = "products"
    RESTAURANT_LOGOS_DIR = "restaurants"
    RECEIPT_IMAGES_DIR = "receipts"
    PROFILE_PHOTOS_DIR = "profiles"
    
    # File constraints
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png', 
        'image/webp',
        'image/gif'
    ]
    ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    
    # Image processing
    IMAGE_QUALITY = 85
    MAX_DIMENSION = 2048
    THUMBNAIL_SIZE = (300, 300)
    
    # Mobile optimized sizes
    MOBILE_SIZES = {
        'thumbnail': (150, 150),
        'small': (300, 300),
        'medium': (600, 600),
        'large': (1200, 1200)
    }

class ImageUploadRequest(BaseModel):
    """Request model for base64 image uploads"""
    image_data: str  # Base64 encoded image
    filename: Optional[str] = None
    alt_text: Optional[str] = None
    generate_thumbnails: bool = True

class ImageUploadResponse(BaseModel):
    """Response model for image uploads"""
    success: bool
    file_id: str
    original_url: str
    thumbnail_url: Optional[str] = None
    variants: dict = {}
    metadata: dict

class FileUploadService:
    """Service for handling file uploads with iOS optimization"""
    
    def __init__(self):
        self.config = FileUploadConfig()
        self._ensure_directories()
        
        # Initialize Spaces storage if enabled
        self.spaces_service = None
        if settings.ENABLE_SPACES_STORAGE:
            try:
                from app.services.storage_service import storage_service
                self.spaces_service = storage_service
                if self.spaces_service.enabled:
                    logger.info("Spaces storage integration enabled")
                else:
                    logger.warning("Spaces storage configured but not available")
            except ImportError:
                logger.warning("Spaces storage service not available")
    
    def _ensure_directories(self):
        """Create upload directories if they don't exist"""
        base_dir = self.config.UPLOAD_DIR
        subdirs = [
            self.config.PRODUCT_IMAGES_DIR,
            self.config.RESTAURANT_LOGOS_DIR,
            self.config.RECEIPT_IMAGES_DIR,
            self.config.PROFILE_PHOTOS_DIR
        ]
        
        os.makedirs(base_dir, exist_ok=True)
        for subdir in subdirs:
            os.makedirs(os.path.join(base_dir, subdir), exist_ok=True)
    
    def validate_base64_image(self, base64_data: str) -> Tuple[bytes, str]:
        """
        Validate base64 image data and return decoded bytes and MIME type
        """
        try:
            # Handle data URL format (data:image/jpeg;base64,...)
            if base64_data.startswith('data:'):
                header, data = base64_data.split(',', 1)
                mime_type = header.split(':')[1].split(';')[0]
            else:
                data = base64_data
                mime_type = None
            
            # Decode base64
            image_bytes = base64.b64decode(data)
            
            # Check file size
            if len(image_bytes) > self.config.MAX_FILE_SIZE:
                raise FynloException(
                    message=f"Image too large. Maximum size is {self.config.MAX_FILE_SIZE / (1024*1024):.1f}MB",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=413
                )
            
            # Validate MIME type using python-magic
            if MAGIC_AVAILABLE:
                detected_mime = magic.from_buffer(image_bytes, mime=True)
                
                if detected_mime not in self.config.ALLOWED_MIME_TYPES:
                    raise FynloException(
                        message=f"Unsupported image format. Allowed types: {', '.join(self.config.ALLOWED_MIME_TYPES)}",
                        error_code=ErrorCodes.VALIDATION_ERROR,
                        status_code=400
                    )
                
                # Use detected MIME type if not provided
                final_mime_type = mime_type if mime_type in self.config.ALLOWED_MIME_TYPES else detected_mime
            else:
                # Temporary fallback without magic
                final_mime_type = mime_type if mime_type else "image/jpeg"
            
            return image_bytes, final_mime_type
            
        except base64.binascii.Error:
            raise FynloException(
                message="Invalid base64 image data",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        except Exception as e:
            raise FynloException(
                message=f"Image validation failed: {str(e)}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
    
    def process_image(self, image_bytes: bytes, mime_type: str) -> Tuple[Image.Image, dict]:
        """
        Process image for mobile optimization
        """
        try:
            # Open image with PIL
            image = Image.open(BytesIO(image_bytes))
            
            # Get original metadata
            metadata = {
                'format': image.format,
                'mode': image.mode,
                'size': image.size,
                'mime_type': mime_type
            }
            
            # Handle EXIF orientation
            image = ImageOps.exif_transpose(image)
            
            # Convert to RGB if necessary (for JPEG output)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize if too large
            if max(image.size) > self.config.MAX_DIMENSION:
                image.thumbnail((self.config.MAX_DIMENSION, self.config.MAX_DIMENSION), Image.Resampling.LANCZOS)
                metadata['resized'] = True
            
            return image, metadata
            
        except Exception as e:
            raise FynloException(
                message=f"Image processing failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def generate_variants(self, image: Image.Image, base_filename: str, upload_path: str) -> dict:
        """
        Generate multiple size variants for mobile optimization
        """
        variants = {}
        
        try:
            for size_name, dimensions in self.config.MOBILE_SIZES.items():
                # Create variant
                variant = image.copy()
                variant.thumbnail(dimensions, Image.Resampling.LANCZOS)
                
                # Save variant
                variant_filename = f"{base_filename}_{size_name}.jpg"
                variant_path = os.path.join(upload_path, variant_filename)
                
                variant.save(
                    variant_path, 
                    'JPEG', 
                    quality=self.config.IMAGE_QUALITY,
                    optimize=True
                )
                
                variants[size_name] = {
                    'filename': variant_filename,
                    'size': variant.size,
                    'url': f"/files/{upload_path.split('/', 1)[1]}/{variant_filename}"
                }
            
            return variants
            
        except Exception as e:
            raise FynloException(
                message=f"Variant generation failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def save_image(self, image: Image.Image, upload_type: str, filename: str = None) -> Tuple[str, str]:
        """
        Save processed image to disk
        """
        try:
            # Generate unique filename
            file_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime("%Y%m%d")
            
            if filename:
                name, ext = os.path.splitext(filename)
                base_filename = f"{timestamp}_{file_id}_{name}"
            else:
                base_filename = f"{timestamp}_{file_id}"
            
            filename = f"{base_filename}.jpg"
            
            # Determine upload path
            type_dirs = {
                'product': self.config.PRODUCT_IMAGES_DIR,
                'restaurant': self.config.RESTAURANT_LOGOS_DIR,
                'receipt': self.config.RECEIPT_IMAGES_DIR,
                'profile': self.config.PROFILE_PHOTOS_DIR
            }
            
            upload_dir = type_dirs.get(upload_type, self.config.PRODUCT_IMAGES_DIR)
            upload_path = os.path.join(self.config.UPLOAD_DIR, upload_dir)
            file_path = os.path.join(upload_path, filename)
            
            # Save main image
            image.save(
                file_path,
                'JPEG',
                quality=self.config.IMAGE_QUALITY,
                optimize=True
            )
            
            return file_id, filename
            
        except Exception as e:
            raise FynloException(
                message=f"Image save failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    async def upload_base64_image_to_spaces(self, 
                                       base64_data: str, 
                                       upload_type: str,
                                       filename: str = None,
                                       user_id: int = None) -> ImageUploadResponse:
        """
        Upload base64 image to DigitalOcean Spaces
        """
        try:
            # Validate and decode
            image_bytes, mime_type = self.validate_base64_image(base64_data)
            
            # Convert to file-like object for Spaces service
            image_file = BytesIO(image_bytes)
            
            # Map upload types to folder names
            folder_map = {
                'product': 'uploads/products',
                'restaurant': 'uploads/restaurants',
                'receipt': 'uploads/receipts',
                'profile': 'uploads/profiles'
            }
            
            folder = folder_map.get(upload_type, 'uploads')
            
            # Upload to Spaces
            upload_result = await self.spaces_service.upload_file(
                file=image_file,
                filename=filename or f"{upload_type}_image.jpg",
                folder=folder,
                user_id=user_id,
                optimize_image=True
            )
            
            return ImageUploadResponse(
                success=True,
                file_id=upload_result['file_path'].split('/')[-1].split('.')[0],  # Extract ID from path
                original_url=upload_result['cdn_url'],
                thumbnail_url=upload_result['cdn_url'],  # CDN handles optimization
                variants={
                    'cdn': {'url': upload_result['cdn_url']},
                    'spaces': {'url': upload_result['spaces_url']}
                },
                metadata={
                    'file_size': upload_result['file_size'],
                    'content_type': upload_result['content_type'],
                    'upload_type': upload_type,
                    'storage_type': 'spaces',
                    'created_at': datetime.utcnow().isoformat(),
                    'file_path': upload_result['file_path']
                }
            )
            
        except Exception as e:
            logger.error(f"Spaces upload failed: {str(e)}")
            raise FynloException(
                message=f"Spaces upload failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )

    async def upload_base64_image(self, 
                                 base64_data: str, 
                                 upload_type: str,
                                 filename: str = None,
                                 generate_variants: bool = True,
                                 user_id: int = None) -> ImageUploadResponse:
        """
        Complete base64 image upload workflow - uses Spaces if enabled, local storage as fallback
        """
        # Try Spaces first if enabled
        if self.spaces_service and self.spaces_service.enabled:
            try:
                # Await async Spaces upload
                return await self.upload_base64_image_to_spaces(
                    base64_data, upload_type, filename, user_id
                )
            except Exception as e:
                logger.warning(f"Spaces upload failed, falling back to local: {str(e)}")
                # Continue to local storage fallback
        
        # Local storage implementation (existing code)
        try:
            # Validate and decode
            image_bytes, mime_type = self.validate_base64_image(base64_data)
            
            # Process image
            image, metadata = self.process_image(image_bytes, mime_type)
            
            # Save image
            file_id, saved_filename = self.save_image(image, upload_type, filename)
            
            # Determine upload directory for URLs
            type_dirs = {
                'product': self.config.PRODUCT_IMAGES_DIR,
                'restaurant': self.config.RESTAURANT_LOGOS_DIR,
                'receipt': self.config.RECEIPT_IMAGES_DIR,
                'profile': self.config.PROFILE_PHOTOS_DIR
            }
            
            upload_dir = type_dirs.get(upload_type, self.config.PRODUCT_IMAGES_DIR)
            upload_path = os.path.join(self.config.UPLOAD_DIR, upload_dir)
            
            # Generate variants
            variants = {}
            if generate_variants:
                base_name = os.path.splitext(saved_filename)[0]
                variants = self.generate_variants(image, base_name, upload_path)
            
            # Create response
            original_url = f"/files/{upload_dir}/{saved_filename}"
            thumbnail_url = variants.get('thumbnail', {}).get('url')
            
            return ImageUploadResponse(
                success=True,
                file_id=file_id,
                original_url=original_url,
                thumbnail_url=thumbnail_url,
                variants=variants,
                metadata={
                    **metadata,
                    'file_size': len(image_bytes),
                    'upload_type': upload_type,
                    'storage_type': 'local',
                    'created_at': datetime.utcnow().isoformat(),
                    'processed_size': image.size
                }
            )
            
        except FynloException:
            raise
        except Exception as e:
            raise FynloException(
                message=f"Upload failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )
    
    def delete_image(self, file_id: str, upload_type: str) -> bool:
        """
        Delete image and all its variants
        """
        try:
            type_dirs = {
                'product': self.config.PRODUCT_IMAGES_DIR,
                'restaurant': self.config.RESTAURANT_LOGOS_DIR,
                'receipt': self.config.RECEIPT_IMAGES_DIR,
                'profile': self.config.PROFILE_PHOTOS_DIR
            }
            
            upload_dir = type_dirs.get(upload_type, self.config.PRODUCT_IMAGES_DIR)
            upload_path = os.path.join(self.config.UPLOAD_DIR, upload_dir)
            
            # Find and delete all files with this file_id
            deleted = False
            for filename in os.listdir(upload_path):
                if file_id in filename:
                    file_path = os.path.join(upload_path, filename)
                    os.remove(file_path)
                    deleted = True
            
            return deleted
            
        except Exception as e:
            raise FynloException(
                message=f"Delete failed: {str(e)}",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=500
            )

# Singleton instance
file_upload_service = FileUploadService()