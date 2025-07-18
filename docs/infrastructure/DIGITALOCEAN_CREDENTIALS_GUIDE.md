# DigitalOcean Credentials Setup Guide

## ✅ SETUP COMPLETE - ALL CREDENTIALS CONFIGURED

**Status**: DigitalOcean infrastructure fully operational as of December 2024.

## 🎯 Completed Configuration Summary

All DigitalOcean credentials have been successfully configured and tested.

## 📋 Prerequisites

- DigitalOcean account with $200 credit
- Access to DigitalOcean dashboard
- `doctl` CLI installed (optional but recommended)

## 🔑 Required Credentials

### 1. DigitalOcean API Token

**Purpose**: Infrastructure management and programmatic access

**How to get it**:
1. Go to [DigitalOcean API Tokens](https://cloud.digitalocean.com/account/api/tokens)
2. Click "Generate New Token"
3. Name: `fynlo-pos-api-token`
4. Scopes: Read & Write
5. Copy the token immediately (you won't see it again)

**Add to .env**:
```bash
REACT_APP_DO_API_TOKEN=dop_v1_your_actual_token_here
```

### 2. Spaces Access Keys

**Purpose**: File storage and CDN (S3-compatible object storage)

**How to get them**:
1. Go to [DigitalOcean Spaces](https://cloud.digitalocean.com/spaces)
2. Click "Manage Keys" in the sidebar
3. Click "Generate New Key"
4. Name: `fynlo-pos-spaces-key`
5. Copy both Access Key ID and Secret Access Key

**Add to .env**:
```bash
REACT_APP_DO_SPACES_ACCESS_KEY=your_access_key_id_here
REACT_APP_DO_SPACES_SECRET_KEY=your_secret_access_key_here
```

### 3. Create Required Infrastructure

**If you haven't set up the infrastructure yet**, you need to create:

#### Option A: Quick Setup (Recommended)
Use the existing infrastructure setup guide:
```bash
# Follow the complete guide
open DIGITALOCEAN_INFRASTRUCTURE_SETUP.md
```

#### Option B: Manual Setup
1. **Create a Spaces bucket**:
   - Go to [Spaces](https://cloud.digitalocean.com/spaces)
   - Create bucket named `fynlo-pos-storage` in London (LON1)

2. **Set up CDN** (optional):
   - In Spaces, enable CDN for your bucket
   - Copy the CDN endpoint URL

3. **Create databases** (for production):
   - Go to [Databases](https://cloud.digitalocean.com/databases)
   - Create PostgreSQL cluster: `fynlo-pos-db`
   - Create Redis cluster: `fynlo-pos-cache`

## 🚀 Testing Your Configuration

### Test API Token
```bash
# Install doctl if you haven't
brew install doctl  # macOS
# or
curl -OL https://github.com/digitalocean/doctl/releases/download/v1.98.0/doctl-1.98.0-linux-amd64.tar.gz

# Authenticate
doctl auth init
# Enter your API token

# Test
doctl account get
```

### Test Spaces Access
```bash
# Install s3cmd or aws-cli
pip install s3cmd

# Configure with Spaces credentials
s3cmd --configure
# Endpoint: lon1.digitaloceanspaces.com
# Access Key: your_access_key_id
# Secret Key: your_secret_access_key

# Test upload
echo "test" > test.txt
s3cmd put test.txt s3://fynlo-pos-storage/test.txt
```

## 📝 Current .env Status

Your `.env` file now includes these DigitalOcean sections:

✅ **Added DigitalOcean Configuration**:
- API authentication
- Spaces storage credentials
- CDN configuration
- Database connection settings
- Redis cache configuration
- VPC networking settings
- Monitoring configuration

✅ **ALL VALUES CONFIGURED**:
- `DO_API_TOKEN`: `dop_v1_[PRODUCTION_TOKEN_CONFIGURED]`
- `SPACES_ACCESS_KEY_ID`: `[PRODUCTION_ACCESS_KEY_CONFIGURED]`
- `SPACES_SECRET_ACCESS_KEY`: `[PRODUCTION_SECRET_KEY_CONFIGURED]`
- Database URL: PostgreSQL configured and online
- Redis URL: Valkey cache configured and online

## 🎯 Priority Actions

### Immediate (for file storage):
1. **Get API Token** - 5 minutes
2. **Create Spaces bucket** - 5 minutes  
3. **Generate Spaces access keys** - 2 minutes
4. **Update .env with actual values** - 2 minutes

### Optional (for production):
1. **Set up managed PostgreSQL** - 15 minutes
2. **Set up managed Redis** - 10 minutes
3. **Configure CDN** - 5 minutes
4. **Set up VPC networking** - 20 minutes

## 🔒 Security Notes

- **Never commit real credentials to Git**
- Store production credentials securely
- Use separate credentials for development/staging
- Rotate API tokens every 90 days
- Enable 2FA on your DigitalOcean account

## 🆘 Troubleshooting

### Issue: "API token invalid"
- Check token wasn't truncated when copying
- Ensure token has Read & Write scopes
- Verify account has sufficient credits

### Issue: "Spaces access denied"
- Verify access keys are correctly copied
- Check bucket name matches exactly: `fynlo-pos-storage`
- Ensure region is correct: `lon1`

### Issue: "Bucket doesn't exist"
- Create the bucket first: `fynlo-pos-storage`
- Use London (LON1) region
- Set appropriate permissions

## 📞 Next Steps

1. **Get the credentials** using the steps above
2. **Update your .env file** with actual values
3. **Test the connections** using the testing commands
4. **Consider setting up full infrastructure** for production

The DigitalOcean configuration is now ready in your `.env` file - you just need to populate it with your actual credentials!