#!/usr/bin/env python3
"""
File Upload Dependencies Fix Script for Fynlo POS
Automatically resolves dependency issues and sets up the file upload system
"""

import subprocess
import sys
import os
import importlib
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def check_dependency(package_name, import_name=None):
    """Check if a dependency is available"""
    if import_name is None:
        import_name = package_name
    
    try:
        importlib.import_module(import_name)
        return True
    except ImportError:
        return False

def install_package(package_spec):
    """Install a package using pip"""
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', 'install', package_spec], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Successfully installed {package_spec}")
            return True
        else:
            print(f"❌ Failed to install {package_spec}: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error installing {package_spec}: {e}")
        return False

def fix_dependencies():
    """Fix all file upload dependencies"""
    print("🔧 Fixing File Upload Dependencies")
    print("=" * 40)
    
    dependencies = [
        ("Pillow", "PIL", "Pillow==10.0.1"),
        ("python-magic-bin", "magic", "python-magic-bin==0.4.14"),
        ("qrcode", "qrcode", "qrcode[pil]==7.4.2")
    ]
    
    all_success = True
    
    for package_name, import_name, pip_spec in dependencies:
        print(f"\\n🔍 Checking {package_name}...")
        
        if check_dependency(package_name, import_name):
            print(f"✅ {package_name} is already available")
        else:
            print(f"❌ {package_name} not found, installing...")
            if install_package(pip_spec):
                # Verify installation
                if check_dependency(package_name, import_name):
                    print(f"✅ {package_name} installation verified")
                else:
                    print(f"❌ {package_name} installation failed verification")
                    all_success = False
            else:
                all_success = False
    
    return all_success

def create_upload_directories():
    """Create all necessary upload directories"""
    print("\\n📁 Creating Upload Directories")
    print("=" * 35)
    
    try:
        base_dir = Path("uploads")
        subdirs = ["products", "restaurants", "receipts", "profiles", "temp", "qr_codes"]
        
        # Create base directory
        base_dir.mkdir(exist_ok=True)
        print(f"✅ Created base directory: {base_dir}")
        
        # Create subdirectories
        for subdir in subdirs:
            subdir_path = base_dir / subdir
            subdir_path.mkdir(exist_ok=True)
            print(f"✅ Created subdirectory: {subdir_path}")
        
        # Create .gitkeep files to ensure directories are tracked
        for subdir in subdirs:
            gitkeep_file = base_dir / subdir / ".gitkeep"
            gitkeep_file.write_text("# Keep this directory in git\\n")
        
        return True
    except Exception as e:
        print(f"❌ Failed to create upload directories: {e}")
        return False

def create_improved_file_service():
    """Create an improved file upload service with better error handling"""
    improved_service = '''"""
Improved File Upload Service for Fynlo POS
Enhanced with better dependency handling and fallback methods
"""

import base64
import os
import uuid
import mimetypes
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image, ImageOps
from io import BytesIO
from datetime import datetime
from pathlib import Path

# Enhanced import handling with fallbacks
try:
    import magic
    MAGIC_AVAILABLE = True
    print("✅ Using python-magic for MIME detection")
except (ImportError, OSError):
    MAGIC_AVAILABLE = False
    print("⚠️ python-magic not available, using fallback MIME detection")

from app.core.exceptions import FynloException, ErrorCodes
from app.core.responses import APIResponseHelper

class EnhancedFileUploadConfig:
    """Enhanced configuration for file uploads with better defaults"""
    
    # Storage paths
    UPLOAD_DIR = "uploads"
    PRODUCT_IMAGES_DIR = "products"
    RESTAURANT_LOGOS_DIR = "restaurants"
    RECEIPT_IMAGES_DIR = "receipts"
    PROFILE_PHOTOS_DIR = "profiles"
    TEMP_DIR = "temp"
    QR_CODES_DIR = "qr_codes"
    
    # File constraints
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
    ]
    ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    
    # Image processing
    IMAGE_QUALITY = 85
    MAX_DIMENSION = 2048
    THUMBNAIL_SIZE = (300, 300)
    MOBILE_VARIANTS = {
        'thumbnail': (300, 300),
        'medium': (800, 600),
        'large': (1200, 900)
    }

class EnhancedFileUploadService:
    """Enhanced file upload service with improved error handling"""
    
    def __init__(self):
        self.config = EnhancedFileUploadConfig()
        self._ensure_directories()
        self._setup_mime_detection()
    
    def _setup_mime_detection(self):
        """Setup MIME detection with fallback"""
        self.mime_detector = None
        if MAGIC_AVAILABLE:
            try:
                # Try to initialize magic
                self.mime_detector = magic.Magic(mime=True)
                print("✅ MIME detection initialized with python-magic")
            except Exception as e:
                print(f"⚠️ Magic initialization failed: {e}, using fallback")
                self.mime_detector = None
    
    def _ensure_directories(self):
        """Create upload directories if they don't exist"""
        base_dir = Path(self.config.UPLOAD_DIR)
        subdirs = [
            self.config.PRODUCT_IMAGES_DIR,
            self.config.RESTAURANT_LOGOS_DIR,
            self.config.RECEIPT_IMAGES_DIR,
            self.config.PROFILE_PHOTOS_DIR,
            self.config.TEMP_DIR,
            self.config.QR_CODES_DIR
        ]
        
        base_dir.mkdir(exist_ok=True)
        for subdir in subdirs:
            (base_dir / subdir).mkdir(exist_ok=True)
    
    def detect_mime_type(self, file_data: bytes, filename: str = None) -> str:
        """Detect MIME type with multiple fallback methods"""
        
        # Method 1: Use python-magic if available
        if self.mime_detector:
            try:
                mime_type = self.mime_detector.from_buffer(file_data)
                if mime_type and mime_type.startswith('image/'):
                    return mime_type
            except Exception as e:
                print(f"⚠️ Magic detection failed: {e}")
        
        # Method 2: Use built-in mimetypes module
        if filename:
            mime_type, _ = mimetypes.guess_type(filename)
            if mime_type and mime_type.startswith('image/'):
                return mime_type
        
        # Method 3: Check file signature (magic bytes)
        if len(file_data) >= 4:
            # JPEG
            if file_data[:3] == b'\\xff\\xd8\\xff':
                return 'image/jpeg'
            # PNG
            elif file_data[:8] == b'\\x89PNG\\r\\n\\x1a\\n':
                return 'image/png'
            # GIF
            elif file_data[:6] in [b'GIF87a', b'GIF89a']:
                return 'image/gif'
            # WebP
            elif file_data[:4] == b'RIFF' and file_data[8:12] == b'WEBP':
                return 'image/webp'
        
        # Method 4: Try to open with PIL
        try:
            img = Image.open(BytesIO(file_data))
            format_to_mime = {
                'JPEG': 'image/jpeg',
                'PNG': 'image/png',
                'GIF': 'image/gif',
                'WEBP': 'image/webp'
            }
            return format_to_mime.get(img.format, 'application/octet-stream')
        except Exception:
            pass
        
        # Fallback
        return 'application/octet-stream'
    
    def validate_base64_image(self, base64_data: str) -> Tuple[bytes, str]:
        """Enhanced base64 image validation with better error handling"""
        try:
            # Handle data URL format
            if base64_data.startswith('data:'):
                header, data = base64_data.split(',', 1)
                declared_mime = header.split(':')[1].split(';')[0]
            else:
                data = base64_data
                declared_mime = None
            
            # Decode base64
            try:
                image_bytes = base64.b64decode(data)
            except Exception as e:
                raise FynloException(
                    message="Invalid base64 data",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    details={"error": str(e)},
                    status_code=400
                )
            
            # Check file size
            if len(image_bytes) > self.config.MAX_FILE_SIZE:
                raise FynloException(
                    message=f"Image too large. Maximum size is {self.config.MAX_FILE_SIZE / (1024*1024):.1f}MB",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    status_code=413
                )
            
            # Detect actual MIME type
            detected_mime = self.detect_mime_type(image_bytes)
            
            # Validate MIME type
            if detected_mime not in self.config.ALLOWED_MIME_TYPES:
                raise FynloException(
                    message=f"Unsupported image type: {detected_mime}",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    details={"allowed_types": self.config.ALLOWED_MIME_TYPES},
                    status_code=415
                )
            
            # Verify it's actually an image by trying to open it
            try:
                img = Image.open(BytesIO(image_bytes))
                img.verify()  # Verify the image is not corrupted
            except Exception as e:
                raise FynloException(
                    message="Invalid or corrupted image data",
                    error_code=ErrorCodes.VALIDATION_ERROR,
                    details={"error": str(e)},
                    status_code=400
                )
            
            return image_bytes, detected_mime
            
        except FynloException:
            raise
        except Exception as e:
            raise FynloException(
                message="Image validation failed",
                error_code=ErrorCodes.VALIDATION_ERROR,
                details={"error": str(e)},
                status_code=400
            )
    
    def process_image_for_mobile(self, image_bytes: bytes) -> Dict[str, bytes]:
        """Process image for mobile optimization with multiple variants"""
        try:
            img = Image.open(BytesIO(image_bytes))
            
            # Convert to RGB if necessary (for JPEG output)
            if img.mode in ['RGBA', 'P']:
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            variants = {}
            
            # Create different size variants
            for variant_name, size in self.config.MOBILE_VARIANTS.items():
                variant_img = img.copy()
                
                # Resize maintaining aspect ratio
                variant_img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Save to bytes
                output = BytesIO()
                variant_img.save(
                    output, 
                    format='JPEG',
                    quality=self.config.IMAGE_QUALITY,
                    optimize=True
                )
                variants[variant_name] = output.getvalue()
            
            # Also include original (potentially resized if too large)
            if img.width > self.config.MAX_DIMENSION or img.height > self.config.MAX_DIMENSION:
                img.thumbnail((self.config.MAX_DIMENSION, self.config.MAX_DIMENSION), Image.Resampling.LANCZOS)
            
            output = BytesIO()
            img.save(output, format='JPEG', quality=self.config.IMAGE_QUALITY, optimize=True)
            variants['original'] = output.getvalue()
            
            return variants
            
        except Exception as e:
            raise FynloException(
                message="Image processing failed",
                error_code=ErrorCodes.INTERNAL_ERROR,
                details={"error": str(e)},
                status_code=500
            )
    
    def save_image_variants(self, variants: Dict[str, bytes], category: str = "products") -> Dict[str, str]:
        """Save image variants and return file paths"""
        try:
            file_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"{timestamp}_{file_id}"
            
            saved_paths = {}
            base_dir = Path(self.config.UPLOAD_DIR) / category
            
            for variant_name, image_bytes in variants.items():
                filename = f"{base_filename}_{variant_name}.jpg"
                file_path = base_dir / filename
                
                with open(file_path, 'wb') as f:
                    f.write(image_bytes)
                
                # Return relative path for URL generation
                saved_paths[variant_name] = f"{category}/{filename}"
            
            return saved_paths
            
        except Exception as e:
            raise FynloException(
                message="Failed to save image files",
                error_code=ErrorCodes.INTERNAL_ERROR,
                details={"error": str(e)},
                status_code=500
            )
    
    def upload_base64_image(self, base64_data: str, category: str = "products") -> Dict[str, Any]:
        """Complete image upload workflow"""
        try:
            # Validate the image
            image_bytes, mime_type = self.validate_base64_image(base64_data)
            
            # Process for mobile
            variants = self.process_image_for_mobile(image_bytes)
            
            # Save files
            file_paths = self.save_image_variants(variants, category)
            
            # Generate response
            return {
                "success": True,
                "file_id": str(uuid.uuid4()),
                "mime_type": mime_type,
                "original_size": len(image_bytes),
                "variants": {
                    variant: {
                        "path": path,
                        "size": len(variants[variant]),
                        "url": f"/api/v1/files/{path}"
                    }
                    for variant, path in file_paths.items()
                },
                "uploaded_at": datetime.utcnow().isoformat()
            }
            
        except FynloException:
            raise
        except Exception as e:
            raise FynloException(
                message="Image upload failed",
                error_code=ErrorCodes.INTERNAL_ERROR,
                details={"error": str(e)},
                status_code=500
            )

# Create service instance
enhanced_upload_service = EnhancedFileUploadService()
'''
    
    # Write the improved service
    with open(project_root / "app" / "core" / "enhanced_file_upload.py", 'w') as f:
        f.write(improved_service)
    
    print("✅ Created enhanced file upload service")
    return True

def test_fixed_dependencies():
    """Test that all dependencies are now working"""
    print("\\n🧪 Testing Fixed Dependencies")
    print("=" * 35)
    
    try:
        # Import the test script
        from test_file_upload_system import FileUploadTester
        
        tester = FileUploadTester()
        success, fixes = tester.run_all_tests()
        
        return success
    except Exception as e:
        print(f"❌ Testing failed: {e}")
        return False

def main():
    """Main fix process"""
    print("🚀 Fynlo POS File Upload Dependencies Fix")
    print("=" * 50)
    
    # Step 1: Fix dependencies
    deps_success = fix_dependencies()
    
    # Step 2: Create upload directories
    dirs_success = create_upload_directories()
    
    # Step 3: Create improved service
    service_success = create_improved_file_service()
    
    # Step 4: Test everything
    if deps_success and dirs_success and service_success:
        print("\\n🧪 Running comprehensive tests...")
        test_success = test_fixed_dependencies()
        
        if test_success:
            print("\\n🎉 File Upload System Fix Complete!")
            print("\\n📋 What was fixed:")
            print("   ✅ All dependencies installed and verified")
            print("   ✅ Upload directories created with proper structure")
            print("   ✅ Enhanced file service with better error handling")
            print("   ✅ Comprehensive testing passed")
            print("\\n📋 Next steps:")
            print("   1. Test file upload endpoints with the iOS app")
            print("   2. Upload product images through the admin interface")
            print("   3. Verify image variants are generated correctly")
            return True
        else:
            print("\\n⚠️ Fix completed but tests still failing")
            print("   Review test output above for remaining issues")
            return False
    else:
        print("\\n❌ Fix process failed")
        print(f"   Dependencies: {'✅' if deps_success else '❌'}")
        print(f"   Directories: {'✅' if dirs_success else '❌'}")
        print(f"   Service: {'✅' if service_success else '❌'}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)