# SumUp Integration Documentation

## Overview
The SumUp integration provides secure payment processing capabilities for the Fynlo POS mobile application. This integration allows merchants to accept card payments using SumUp's payment processing infrastructure without exposing sensitive API keys to the mobile app.

## Endpoints

### 1. Initialize SumUp Configuration
**POST** `/api/v1/sumup/initialize`

Retrieves the SumUp configuration needed for mobile app initialization.

**Request Body:**
```json
{
  "mode": "production"  // Optional: "sandbox" or "production"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant_code": "MC123456",
    "environment": "production",
    "app_id": "com.fynlo.pos",
    "enabled": true,
    "features": {
      "card_reader": true,
      "tap_to_pay": true,
      "refunds": true
    }
  },
  "message": "SumUp configuration retrieved successfully",
  "timestamp": "2024-07-29T10:00:00Z"
}
```

### 2. Get SumUp Status
**GET** `/api/v1/sumup/status`

Returns the current status of the SumUp integration.

**Response:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "environment": "production",
    "last_transaction": null,
    "total_transactions": 0,
    "features": {
      "card_reader": true,
      "tap_to_pay": true,
      "refunds": true
    }
  },
  "message": "SumUp status retrieved successfully",
  "timestamp": "2024-07-29T10:00:00Z"
}
```

### 3. Validate Merchant Code
**POST** `/api/v1/sumup/validate-merchant`

Validates a SumUp merchant code format.

**Query Parameters:**
- `merchant_code` (string, required): The merchant code to validate

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant_code": "MC123456",
    "valid": true,
    "message": "Merchant code format is valid"
  },
  "message": "Merchant code validated successfully",
  "timestamp": "2024-07-29T10:00:00Z"
}
```

## Security Features

1. **Authentication Required**: All endpoints require a valid authentication token
2. **Rate Limiting**: 
   - Initialize: 10 requests/minute
   - Status: 30 requests/minute
   - Validate: 5 requests/minute
3. **Tenant Isolation**: Configuration is specific to the authenticated user's restaurant
4. **No API Key Exposure**: The SumUp API key is never exposed to the client

## Environment Configuration

Add the following variables to your `.env` file:

```bash
# SumUp Configuration
SUMUP_API_KEY="your_sumup_api_key_here"
SUMUP_ENVIRONMENT="production"  # or "sandbox" for testing
SUMUP_APP_ID="com.fynlo.pos"   # Your app identifier
SUMUP_MERCHANT_CODE=""          # Optional default merchant code
```

## Mobile App Integration

The mobile app should use the `/initialize` endpoint to get the necessary configuration for initializing the SumUp SDK:

```typescript
// Example TypeScript/React Native code
const initializeSumUp = async () => {
  try {
    const response = await api.post('/sumup/initialize', {
      mode: 'production'
    });
    
    if (response.data.success && response.data.data.enabled) {
      const config = response.data.data;
      
      // Initialize SumUp SDK with the configuration
      await SumUpSDK.initialize({
        appId: config.app_id,
        merchantCode: config.merchant_code,
        environment: config.environment
      });
    }
  } catch (error) {
    console.error('Failed to initialize SumUp:', error);
  }
};
```

## Testing

Use the provided test script to verify the endpoints:

```bash
cd backend
python test_sumup_endpoint.py
```

Make sure to update the `TEST_TOKEN` in the script with a valid authentication token.

## Future Enhancements

1. **Per-Restaurant Configuration**: Store merchant codes per restaurant in the database
2. **Transaction History**: Track and retrieve SumUp transaction history
3. **Webhook Integration**: Handle SumUp webhooks for real-time payment status updates
4. **Advanced Features**: Support for partial refunds, tips, and recurring payments
5. **Subscription-Based Features**: Enable/disable features based on restaurant subscription plan