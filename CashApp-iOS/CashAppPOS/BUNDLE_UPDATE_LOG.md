# iOS Bundle Update Log

## Bundle Update - January 14, 2025 (v12 - Complete Security Fix)

### Purpose
Update iOS JavaScript bundle to fix ALL security vulnerabilities in WebSocket authentication including restaurant ID encoding.

### Security Fixes in This Bundle:
1. **Complete URL Encoding**: Properly encode ALL parameters including restaurant_id, user_id, and token
2. **Token Security**: No longer expose authentication tokens in console logs
3. **Safe Parameter Handling**: Prevent URL parsing errors and authentication failures for all parameters

### Changes Included:
1. **WebSocket Token Authentication**: Added token parameter to WebSocket connection URL for proper authentication
2. **Customer Date Handling**: Fixed TypeError by adding null checks for joinedDate and lastVisit
3. **API Endpoint Updates**: Updated to use production DigitalOcean backend URLs
4. **Platform Settings**: Using new public endpoints that don't require authentication
5. **Security Improvements**: Complete URL encoding for all parameters and token masking in logs

### Bundle Build Details:
- **Build Date**: January 14, 2025
- **Build Command**: `npx metro build index.js --platform ios --dev false --out ios/main.jsbundle`
- **Bundle Location**: `ios/CashAppPOS/main.jsbundle`
- **Previous Bundle**: January 14, 2025 (v11)
- **New Bundle**: January 14, 2025 (v12 - Complete Security Fix)

### Security Notes:
- ALL parameters (restaurant_id, user_id, token) are now properly URL encoded
- Tokens are masked in console logs (shown as ***)
- Special characters in any parameter won't cause connection failures
- Restaurant IDs with special characters are now handled correctly

### Testing Notes:
- The app should now properly authenticate WebSocket connections
- Customer screen should no longer crash
- All API calls should go to production backend
- No more localhost connections
- ALL parameters with special characters will work correctly

### Deployment:
This bundle is ready for deployment and testing on physical iOS devices.