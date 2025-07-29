# SumUp API Key Security Fix

## Issue Summary
The SumUp API key was hardcoded in the mobile application, exposing it to potential security risks. This fix moves the API key to secure backend storage and provides a secure endpoint for mobile app initialization.

## Changes Made

### Backend Changes

1. **Created Secure Endpoint** (`/api/v1/endpoints/sumup.py`)
   - `GET /api/v1/sumup/initialize` - Returns SumUp configuration without exposing API key
   - `GET /api/v1/sumup/status` - Returns integration status
   - `POST /api/v1/sumup/validate-merchant` - Validates merchant codes
   - All endpoints require authentication

2. **Environment Configuration**
   - Added SumUp API key to `.env` file (already in .gitignore)
   - Key is now stored as: `SUMUP_API_KEY="sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"`
   - Environment: `SUMUP_ENVIRONMENT="production"`
   - App ID: `SUMUP_APP_ID="com.anonymous.cashapppos"`

### Mobile App Changes

1. **Created SumUpConfigService** (`/src/services/SumUpConfigService.ts`)
   - Fetches SumUp configuration from backend
   - Implements caching for performance
   - Handles authentication and error cases

2. **Updated Components**
   - `App.tsx` - Removed hardcoded API key from initialization
   - `SumUpNativeService.ts` - Modified to work without API key
   - `SumUpPaymentComponent.tsx` - Fetches config from backend before initializing
   - `SumUpTestComponent.tsx` - Also updated to use backend configuration
   - `PaymentScreen.tsx` - Removed API key from payment processing

3. **Security Improvements**
   - API key never exposed to client
   - Configuration fetched over secure authenticated connection
   - Graceful fallback if configuration fails

## Testing Required

1. **Backend Testing**
   ```bash
   cd backend
   python test_sumup_endpoint.py
   ```

2. **Mobile App Testing**
   - Verify SumUp payments still work
   - Test error handling when backend is unavailable
   - Confirm no API keys in mobile app bundle

## Deployment Notes

1. **Backend Deployment**
   - Ensure `SUMUP_API_KEY` environment variable is set in production
   - Update DigitalOcean App Platform environment variables

2. **Mobile App Deployment**
   - Rebuild iOS app bundle
   - Test thoroughly before release
   - Monitor for any payment failures

## Security Benefits

1. **API Key Protection** - Key is no longer exposed in client code
2. **Access Control** - Only authenticated users can retrieve configuration
3. **Audit Trail** - All configuration requests are logged
4. **Easy Rotation** - API key can be changed without app updates

## Migration Steps

1. Deploy backend with new endpoint
2. Set environment variables in production
3. Deploy updated mobile app
4. Monitor for issues
5. Rotate API key if needed (backend only)