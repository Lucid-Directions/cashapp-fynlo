# iOS Bundle Update Log

## Bundle Update - January 14, 2025

### Purpose
Update iOS JavaScript bundle to include all recent fixes and improvements.

### Changes Included in This Bundle:
1. **WebSocket Token Authentication**: Added token parameter to WebSocket connection URL for proper authentication
2. **Customer Date Handling**: Fixed TypeError by adding null checks for joinedDate and lastVisit
3. **API Endpoint Updates**: Updated to use production DigitalOcean backend URLs
4. **Platform Settings**: Using new public endpoints that don't require authentication

### Bundle Build Details:
- **Build Date**: January 14, 2025
- **Build Command**: `npx metro build index.js --platform ios --dev false --out ios/main.jsbundle`
- **Bundle Location**: `ios/CashAppPOS/main.jsbundle`
- **Previous Bundle**: January 8, 2025 (v9)
- **New Bundle**: January 14, 2025 (v10)

### Testing Notes:
- The app should now properly authenticate WebSocket connections
- Customer screen should no longer crash
- All API calls should go to production backend
- No more localhost connections

### Deployment:
This bundle is ready for deployment and testing on physical iOS devices.