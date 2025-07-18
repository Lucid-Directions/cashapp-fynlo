# iOS Bundle Update Log

## Bundle Update - January 14, 2025 (v11 - Security Fix)

### Purpose
Update iOS JavaScript bundle to fix critical security vulnerabilities in WebSocket authentication.

### Security Fixes in This Bundle:
1. **URL Encoding for WebSocket Parameters**: Properly encode user_id and token to handle special characters
2. **Token Security**: No longer expose authentication tokens in console logs
3. **Safe Parameter Handling**: Prevent URL parsing errors and authentication failures

### Changes Included:
1. **WebSocket Token Authentication**: Added token parameter to WebSocket connection URL for proper authentication
2. **Customer Date Handling**: Fixed TypeError by adding null checks for joinedDate and lastVisit
3. **API Endpoint Updates**: Updated to use production DigitalOcean backend URLs
4. **Platform Settings**: Using new public endpoints that don't require authentication
5. **Security Improvements**: URL encoding and token masking in logs

### Bundle Build Details:
- **Build Date**: January 14, 2025
- **Build Command**: `npx metro build index.js --platform ios --dev false --out ios/main.jsbundle`
- **Bundle Location**: `ios/CashAppPOS/main.jsbundle`
- **Previous Bundle**: January 14, 2025 (v10)
- **New Bundle**: January 14, 2025 (v11 - Security Fix)

### Security Notes:
- Authentication tokens are now properly URL encoded
- Tokens are masked in console logs (shown as ***)
- Special characters in tokens won't cause connection failures

### Testing Notes:
- The app should now properly authenticate WebSocket connections
- Customer screen should no longer crash
- All API calls should go to production backend
- No more localhost connections
- Tokens with special characters will work correctly

### Deployment:
This bundle is ready for deployment and testing on physical iOS devices.