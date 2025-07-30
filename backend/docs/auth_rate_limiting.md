# Authentication Rate Limiting

## Overview

Fynlo POS implements rate limiting on authentication endpoints to prevent brute force attacks and ensure system stability. This document describes the rate limiting implementation for authentication endpoints.

## Implementation Details

### Rate Limits

Authentication endpoints are limited to **5 requests per minute** per client to prevent brute force attacks.

- `/api/v1/auth/verify` - 5 requests/minute
- `/api/v1/auth/register-restaurant` - 5 requests/minute

### Client Identification

Rate limiting uses a smart client identification strategy:

1. **Authenticated users**: Rate limited by user ID + client type
2. **Unauthenticated requests**: Rate limited by IP address + client type

This ensures that:
- Each user has their own rate limit quota
- Unauthenticated requests from the same IP are collectively limited
- Different client types (mobile app, web portal) have separate quotas

### Rate Limiting Algorithm

The system uses a **moving window** algorithm implemented by SlowAPI with Redis backend:
- Provides smooth rate limiting without sudden resets
- Accurately tracks request rates over time
- Prevents burst attacks at window boundaries

### Response Headers

Rate limited responses include the following headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

### Error Response

When rate limit is exceeded:
```json
{
  "status": "error",
  "message": "Rate limit exceeded",
  "data": {
    "detail": "Rate limit exceeded: 5 per 1 minute"
  }
}
```

HTTP Status Code: `429 Too Many Requests`

## Configuration

Rate limits are configured in `app/core/rate_limit_config.py`:

```python
AUTH_RATES = {
    "login": "5/minute",
    "register": "3/minute",
    "password_reset": "3/minute",
    "verify_email": "10/minute",
    "refresh_token": "10/minute"
}
```

### Environment-Specific Adjustments

Rate limits are automatically adjusted based on environment:
- **Production**: 1x (standard limits)
- **Staging**: 1.5x
- **Development**: 2x
- **Test**: 10x

### Role-Based Adjustments

Users with higher privileges get increased rate limits:
- **Platform Owner**: 2x
- **Restaurant Owner**: 1.5x
- **Manager**: 1.2x
- **Employee**: 1x
- **Customer**: 0.8x

## Security Considerations

### Audit Logging

All authentication attempts (successful and failed) are logged to the audit system with:
- IP address
- User agent
- Timestamp
- Risk score
- Failure reason (if applicable)

### Additional Protection

Beyond rate limiting, the authentication system includes:
- Failed login tracking with exponential backoff
- IP-based blocking for repeated violations
- Anomaly detection for suspicious patterns
- Real-time alerting for security events

## Testing

Rate limiting is tested in `backend/tests/test_rate_limiting.py`:
- Tests verify correct limit enforcement
- Tests confirm rate limit reset after time window
- Tests validate separate limits for different endpoints
- Tests ensure proper headers are returned

## Monitoring

Rate limit violations are monitored through:
- Application logs (WARNING level for violations)
- Audit logs (with risk scores)
- Metrics dashboard (if configured)
- Alert system for excessive violations

## Best Practices

1. **Client Implementation**:
   - Respect `Retry-After` header
   - Implement exponential backoff
   - Cache authentication tokens appropriately
   - Show user-friendly error messages

2. **Error Handling**:
   ```typescript
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     // Wait and retry or show user message
   }
   ```

3. **Token Management**:
   - Store tokens securely
   - Refresh before expiration
   - Avoid unnecessary verification calls

## Troubleshooting

### Common Issues

1. **"Rate limit exceeded" errors**:
   - Check if client is making unnecessary repeated calls
   - Verify token caching is working correctly
   - Consider implementing request debouncing

2. **Different rate limits than expected**:
   - Check environment configuration
   - Verify user role multipliers
   - Ensure Redis is properly connected

3. **Rate limits not resetting**:
   - Check Redis connectivity
   - Verify system time synchronization
   - Review rate limiter logs