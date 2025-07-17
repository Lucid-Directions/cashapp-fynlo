# 📁 **Fynlo POS File Upload System**

Complete file upload system with dependency resolution, image processing, and iOS optimization.

## 🚀 **Quick Start**

### Automatic Setup
```bash
cd backend
python fix_file_upload_dependencies.py
```

This script will:
- ✅ Install all required dependencies
- ✅ Create upload directory structure
- ✅ Generate enhanced file upload service
- ✅ Run comprehensive tests

### Manual Verification
```bash
# Test dependencies
python test_file_upload_system.py

# Test API endpoints (server must be running)
python test_file_upload_endpoints.py
```

## 📋 **System Requirements**

### Required Dependencies
- **Pillow** (10.0.1+) - Image processing and optimization
- **python-magic-bin** (0.4.14+) - MIME type detection
- **qrcode[pil]** (7.4.2+) - QR code generation

### Optional Dependencies
- **Redis** - Caching for improved performance
- **PostgreSQL** - Database for file metadata

## 🏗️ **Architecture Overview**

### Directory Structure
```
uploads/
├── products/          # Product images
├── restaurants/       # Restaurant logos
├── receipts/          # Receipt images
├── profiles/          # User profile photos
├── temp/             # Temporary files
└── qr_codes/         # Generated QR codes
```

### File Processing Pipeline
1. **Base64 Validation** - Decode and validate input
2. **MIME Detection** - Multi-method type detection
3. **Security Validation** - File size and type checks
4. **Image Processing** - Mobile-optimized variants
5. **Storage** - Organized file system storage
6. **URL Generation** - API endpoints for access

## 🔧 **Configuration**

### File Constraints
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]
IMAGE_QUALITY = 85
MAX_DIMENSION = 2048
```

### Mobile Variants
```python
MOBILE_VARIANTS = {
    'thumbnail': (300, 300),    # For lists and previews
    'medium': (800, 600),       # For detail views
    'large': (1200, 900)        # For full-screen display
}
```

## 📱 **iOS Integration**

### Upload Format
```typescript
// iOS sends base64 data with data URL format
const uploadData = {
  file_data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
  category: "products",
  filename: "burger.jpg",
  description: "Delicious burger image"
};
```

### API Response
```json
{
  "success": true,
  "file_id": "uuid-here",
  "mime_type": "image/jpeg",
  "original_size": 524288,
  "variants": {
    "thumbnail": {
      "path": "products/20250620_143022_uuid_thumbnail.jpg",
      "size": 12345,
      "url": "/api/v1/files/products/20250620_143022_uuid_thumbnail.jpg"
    },
    "medium": {
      "path": "products/20250620_143022_uuid_medium.jpg", 
      "size": 45678,
      "url": "/api/v1/files/products/20250620_143022_uuid_medium.jpg"
    },
    "large": {
      "path": "products/20250620_143022_uuid_large.jpg",
      "size": 98765,
      "url": "/api/v1/files/products/20250620_143022_uuid_large.jpg"
    }
  },
  "uploaded_at": "2025-06-20T14:30:22Z"
}
```

## 🛡️ **Security Features**

### Validation Layers
1. **Base64 Validation** - Proper encoding check
2. **MIME Type Detection** - Multiple detection methods
3. **File Signature Verification** - Magic bytes validation
4. **Image Integrity Check** - PIL verification
5. **Size Limits** - Configurable file size restrictions

### MIME Detection Methods
1. **python-magic** - Primary method (most accurate)
2. **Built-in mimetypes** - Standard library fallback
3. **File Signatures** - Magic bytes detection
4. **PIL Format Detection** - Image library verification

## 🔄 **Error Handling**

### Common Errors
```python
# Invalid base64 data
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid base64 data"
  }
}

# File too large
{
  "error": {
    "code": "VALIDATION_ERROR", 
    "message": "Image too large. Maximum size is 10.0MB"
  }
}

# Unsupported format
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unsupported image type: image/bmp"
  }
}
```

### Graceful Degradation
- Falls back to extension-based MIME detection if python-magic unavailable
- Uses PIL format detection as secondary validation
- Provides detailed error messages for debugging

## 🧪 **Testing**

### Unit Tests
```bash
# Test all dependencies and core functionality
python test_file_upload_system.py
```

### Integration Tests  
```bash
# Test API endpoints (requires running server)
python test_file_upload_endpoints.py
```

### Test Coverage
- ✅ Dependency availability
- ✅ Directory permissions
- ✅ Base64 validation
- ✅ MIME type detection
- ✅ Image processing
- ✅ File storage
- ✅ API endpoints
- ✅ Error handling
- ✅ Authentication integration

## 🚀 **API Endpoints**

### Upload Image
```http
POST /api/v1/files/upload
Authorization: Bearer <token>
Content-Type: application/json

{
  "file_data": "data:image/jpeg;base64,...",
  "category": "products",
  "filename": "image.jpg",
  "description": "Optional description"
}
```

### Serve Files
```http
GET /api/v1/files/{category}/{filename}
```

### List Files
```http
GET /api/v1/files/{category}/
Authorization: Bearer <token>
```

## ⚡ **Performance Optimization**

### Image Processing
- **Lazy Loading** - Process variants on demand
- **Quality Optimization** - Balanced quality vs size
- **Format Conversion** - JPEG for smaller file sizes
- **Thumbnail Generation** - Fast preview loading

### Caching Strategy
- **Static File Serving** - Direct file system access
- **CDN Ready** - URL structure supports CDN integration
- **Browser Caching** - Appropriate cache headers

## 🔧 **Troubleshooting**

### Common Issues

**Error: "python-magic not available"**
```bash
pip install python-magic-bin==0.4.14
```

**Error: "PIL/Pillow not found"**
```bash
pip install Pillow==10.0.1
```

**Error: "Upload directory not writable"**
```bash
# Check permissions
ls -la uploads/
# Fix permissions if needed
chmod 755 uploads/
```

**Error: "File too large"**
- Increase `MAX_FILE_SIZE` in configuration
- Optimize image before upload on iOS side

### Debug Mode
```python
# Enable detailed logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🏭 **Production Deployment**

### Security Checklist
- [ ] Set secure upload directory permissions (755)
- [ ] Configure web server to serve static files
- [ ] Set up CDN for file delivery
- [ ] Enable virus scanning for uploads
- [ ] Configure file cleanup policies

### Performance Checklist
- [ ] Enable Redis caching for metadata
- [ ] Set up background processing for large images
- [ ] Configure appropriate cache headers
- [ ] Monitor upload directory disk usage
- [ ] Set up automated image optimization

### Monitoring
- File upload success/failure rates
- Upload directory disk usage
- Image processing performance
- API response times

## 📞 **Support**

### Test Commands
```bash
# Quick dependency check
python -c "import magic, PIL; print('All dependencies available')"

# Test upload directory
python -c "import os; print('Upload dir exists:', os.path.exists('uploads'))"

# Test image processing
python -c "from PIL import Image; img=Image.new('RGB',(100,100)); print('PIL working')"
```

### Common Solutions
1. **Reinstall dependencies**: `pip install -r requirements.txt --force-reinstall`
2. **Reset upload directories**: `rm -rf uploads && python fix_file_upload_dependencies.py`
3. **Check server logs**: Look for detailed error messages in FastAPI logs
4. **Verify permissions**: Ensure upload directory is writable

---

**File Upload System Ready!** 🎉

Your Fynlo POS file upload system is now fully configured and tested.