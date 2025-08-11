# PR#3: Menu Loading Fallback & Error Handling

## Problem
- Backend API returns 500 errors for `/api/v1/menu/items` endpoint
- POS screen shows empty menu when API fails
- No error handling or fallback data when menu fails to load
- Users see blank screen with no indication of what went wrong

## Solution
1. Add proper error handling in DataService for menu loading
2. Implement fallback to MockDataService when API fails
3. Show loading states and error messages to users
4. Add retry mechanism for failed API calls
5. Cache last successful menu data for offline use

## Files to Change
- `src/services/DataService.ts` - Add error handling and fallback logic
- `src/screens/main/POSScreen.tsx` - Add loading/error states
- `src/services/MockDataService.ts` - Ensure demo data is available
- `src/utils/cacheManager.ts` - Add menu caching logic

## Testing
- Test with backend API down
- Test with network errors
- Verify fallback to mock data works
- Check error messages are user-friendly