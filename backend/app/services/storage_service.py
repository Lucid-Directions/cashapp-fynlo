"""
DigitalOcean Spaces Storage Service
Handles file uploads, downloads, and management with CDN delivery
"""


"""
import hashlib
import os
import logging
from typing import Optional, Dict, BinaryIO, List, TYPE_CHECKING
from datetime import datetime
from io import BytesIO

from app.core.config import settings
from app.core.exceptions import FynloException, ErrorCodes

# Lazy imports to prevent deployment failures when boto3 is not available
if TYPE_CHECKING:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    from PIL import Image
else:
    boto3 = None
    ClientError = None
    NoCredentialsError = None
    Image = None

logger = logging.getLogger(__name__)


class StorageService:
    """DigitalOcean Spaces file management service"""
    
    def __init__(self):
        """Initialize the storage service"""
        self.enabled = settings.ENABLE_SPACES_STORAGE
        self.client = None
        
        # Lazy load boto3 to prevent deployment failures
        if self.enabled:
            global boto3, ClientError, NoCredentialsError
            if boto3 is None:
                try:
                    import boto3
                    from botocore.exceptions import ClientError, NoCredentialsError
                except ImportError:
                    logger.warning("boto3 not available - storage service disabled")
                    self.enabled = False
                    return
        
        if self.enabled and self._validate_credentials():
            try:
                # Configure S3-compatible client for Spaces
                self.client = boto3.client(
                    's3',
                    endpoint_url=settings.SPACES_ENDPOINT,
                    aws_access_key_id=settings.SPACES_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.SPACES_SECRET_ACCESS_KEY,
                    region_name=settings.SPACES_REGION
                )
                
                self.bucket = settings.SPACES_BUCKET
                self.cdn_endpoint = settings.CDN_ENDPOINT
                self.max_file_size = settings.MAX_FILE_SIZE
                self.allowed_types = settings.ALLOWED_FILE_TYPES.split(',')
                
                logger.info(f"Storage service initialized for bucket: {self.bucket}")
                
            except Exception as e:
                logger.error(f"Failed to initialize Spaces client: {e}")
                self.enabled = False
                self.client = None
        else:
            self.client = None
            logger.info("Spaces storage disabled - using local storage fallback")
    
    def _validate_credentials(self) -> bool:
        """Validate that required credentials are present"""
        required_settings = [
            settings.SPACES_ACCESS_KEY_ID,
            settings.SPACES_SECRET_ACCESS_KEY,
            settings.SPACES_BUCKET
        ]
        
        if not all(required_settings):
            logger.warning("Missing DigitalOcean Spaces credentials")
            return False
        
        return True
    
    async def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = "uploads",
        user_id: Optional[int] = None,
        optimize_image: bool = True
    ) -> Dict[str, str]:
        """Upload file to Spaces with optimization"""
        
        if not self.enabled or not self.client:
            raise FynloException(
                message="Storage service not available",
                error_code=ErrorCodes.INTERNAL_ERROR,
                status_code=503
            )
        
        try:
            # Read and validate file
            file_content = file.read()
            file.seek(0)  # Reset file pointer
            
            self._validate_file(file_content, filename)
            
            # Generate unique filename with timestamp
            file_hash = hashlib.md5(file_content).hexdigest()[:8]
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_ext = os.path.splitext(filename)[1].lower()
            unique_filename = f"{timestamp}_{file_hash}{file_ext}"
            
            # Create organized file path
            if user_id:
                file_path = f"{folder}/user_{user_id}/{unique_filename}"
            else:
                file_path = f"{folder}/{unique_filename}"
            
            # Optimize images for web delivery
            if optimize_image and file_ext in ['.jpg', '.jpeg', '.png']:
                file_content = self._optimize_image(file_content, file_ext)
            
            # Upload to Spaces
            self.client.put_object(
                Bucket=self.bucket,
                Key=file_path,
                Body=file_content,
                ContentType=self._get_content_type(filename),
                ACL='public-read',  # Enable CDN access
                Metadata={
                    'original_filename': filename,
                    'user_id': str(user_id) if user_id else '',
                    'upload_timestamp': datetime.now().isoformat(),
                    'uploaded_by': 'fynlo_pos_backend'
                }
            )
            
            # Generate URLs
            spaces_url = f"{settings.SPACES_ENDPOINT}/{self.bucket}/{file_path}"
            cdn_url = f"{self.cdn_endpoint}/{file_path}" if self.cdn_endpoint else spaces_url
            
            logger.info(f"File uploaded successfully: {file_path}")
            
            return {
                'filename': unique_filename,
                'original_filename': filename,
                'file_path': file_path,
                'spaces_url': spaces_url,
                'cdn_url': cdn_url,
                'file_size': len(file_content),
                'content_type': self._get_content_type(filename)
            }
            
        except Exception as e:
            # Handle ClientError specifically if boto3 is available
            if ClientError and isinstance(e, ClientError):
                error_code = e.response['Error']['Code']
                logger.error(f"Spaces client error ({error_code}): {str(e)}")
                raise FynloException(
                    message=f"Upload failed: {error_code}",
                    error_code=ErrorCodes.EXTERNAL_SERVICE_ERROR,
                    status_code=503
                )
            else:
                logger.error(f"File upload failed: {str(e)}")
                raise FynloException(
                    message=f"Upload failed: {str(e)}",
                    error_code=ErrorCodes.INTERNAL_ERROR,
                    status_code=500
                )
    
    def _validate_file(self, file_content: bytes, filename: str) -> None:
        """Validate file size and type"""
        
        # Check file size
        if len(file_content) > self.max_file_size:
            raise FynloException(
                message=f"File too large. Maximum size: {self.max_file_size / (1024*1024):.1f}MB",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=413
            )
        
        # Check file extension
        file_ext = os.path.splitext(filename)[1].lower().lstrip('.')
        if file_ext not in self.allowed_types:
            raise FynloException(
                message=f"File type not allowed. Allowed types: {', '.join(self.allowed_types)}",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Basic content validation for images
        if file_ext in ['jpg', 'jpeg', 'png', 'gif']:
            global Image
            if Image is None:
                try:
                    from PIL import Image
                except ImportError:
                    logger.warning("PIL not available - skipping image validation")
                    return
            
            try:
                Image.open(BytesIO(file_content))
            except Exception:
                raise FynloException(
                    message="Invalid image file",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=400
                )
    
    def _optimize_image(self, image_content: bytes, file_ext: str) -> bytes:
        """Optimize image for web delivery"""
        
        global Image
        if Image is None:
            try:
                from PIL import Image
            except ImportError:
                logger.warning("PIL not available - returning original image")
                return image_content
        
        try:
            # Open image
            image = Image.open(BytesIO(image_content))
            
            # Convert RGBA to RGB if saving as JPEG
            if file_ext.lower() in ['.jpg', '.jpeg'] and image.mode in ['RGBA', 'LA']:
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'RGBA':
                    background.paste(image, mask=image.split()[-1])
                else:
                    background.paste(image)
                image = background
            
            # Resize if too large (max 1920px width)
            max_width = 1920
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Save optimized image
            output = BytesIO()
            format_map = {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG'}
            image_format = format_map.get(file_ext.lower(), 'JPEG')
            
            if image_format == 'JPEG':
                image.save(output, format=image_format, quality=85, optimize=True)
            else:
                image.save(output, format=image_format, optimize=True)
            
            optimized_content = output.getvalue()
            
            logger.info(f"Image optimized: {len(image_content)} → {len(optimized_content)} bytes")
            return optimized_content
            
        except Exception as e:
            logger.warning(f"Image optimization failed: {e}")
            return image_content  # Return original if optimization fails
    
    def _get_content_type(self, filename: str) -> str:
        """Get content type for file"""
        
        ext_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        file_ext = os.path.splitext(filename)[1].lower()
        return ext_map.get(file_ext, 'application/octet-stream')
    
    async def delete_file(self, file_path: str) -> bool:
        """Delete file from Spaces"""
        
        if not self.enabled or not self.client:
            logger.warning("Spaces storage not available for deletion")
            return False
        
        try:
            self.client.delete_object(Bucket=self.bucket, Key=file_path)
            logger.info(f"File deleted: {file_path}")
            return True
            
        except Exception as e:
            # Handle ClientError specifically if boto3 is available
            if ClientError and isinstance(e, ClientError):
                error_code = e.response['Error']['Code']
                if error_code == 'NoSuchKey':
                    logger.warning(f"File not found for deletion: {file_path}")
                    return False
                logger.error(f"Spaces deletion error ({error_code}): {str(e)}")
                return False
            else:
                logger.error(f"File deletion failed: {str(e)}")
                return False
    
    async def get_presigned_url(
        self,
        file_path: str,
        expiration: int = 3600
    ) -> Optional[str]:
        """Generate presigned URL for secure file access"""
        
        if not self.enabled or not self.client:
            return None
        
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': file_path},
                ExpiresIn=expiration
            )
            
            return url
            
        except Exception as e:
            logger.error(f"Presigned URL generation failed: {str(e)}")
            return None
    
    async def list_files(
        self,
        prefix: str = "",
        limit: int = 100
    ) -> List[Dict[str, any]]:
        """List files in bucket with pagination"""
        
        if not self.enabled or not self.client:
            return []
        
        try:
            response = self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
                MaxKeys=limit
            )
            
            files = []
            for obj in response.get('Contents', []):
                cdn_url = f"{self.cdn_endpoint}/{obj['Key']}" if self.cdn_endpoint else f"{settings.SPACES_ENDPOINT}/{self.bucket}/{obj['Key']}"
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'cdn_url': cdn_url
                })
            
            return files
            
        except Exception as e:
            logger.error(f"File listing failed: {str(e)}")
            return []
    
    def get_public_url(self, file_path: str) -> str:
        """Get public CDN URL for a file"""
        if self.cdn_endpoint:
            return f"{self.cdn_endpoint}/{file_path}"
        else:
            return f"{settings.SPACES_ENDPOINT}/{self.bucket}/{file_path}"
    
    async def check_health(self) -> Dict[str, any]:
        """Check storage service health"""
        
        if not self.enabled:
            return {
                'status': 'disabled',
                'message': 'Spaces storage is disabled'
            }
        
        if not self.client:
            return {
                'status': 'error',
                'message': 'Spaces client not initialized'
            }
        
        try:
            # Test connection by listing bucket (with limit 1)
            self.client.list_objects_v2(Bucket=self.bucket, MaxKeys=1)
            
            return {
                'status': 'healthy',
                'message': 'Spaces storage is operational',
                'bucket': self.bucket,
                'endpoint': settings.SPACES_ENDPOINT
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Spaces connection failed: {str(e)}'
            }


# Global service instance
storage_service = StorageService()