# Replica Count Monitoring Guide

## Overview

This guide documents the replica monitoring system implemented to address the DigitalOcean App Platform issue where the dashboard shows incorrect replica counts (Issue #356).

## Known Issue

DigitalOcean App Platform may display incorrect replica counts in the dashboard. For example:
- **Configured**: 2 replicas
- **Dashboard shows**: 4, 6, or other incorrect numbers
- **Actual running**: 2 (as configured)

This is a display issue that doesn't affect actual performance or billing.

## Solution Architecture

### 1. Instance Tracking System

Each backend instance registers itself with Redis and maintains a heartbeat:
- **Registration**: On startup, each instance creates a unique ID
- **Heartbeat**: Every 10 seconds, instances update their status
- **TTL**: 30 seconds - instances are considered dead if no heartbeat
- **Cleanup**: Automatic removal of stale instances

### 2. Health Monitoring Endpoints

#### `/api/v1/health/detailed`
Comprehensive health information for the current instance:
```json
{
  "status": "healthy",
  "instance": {
    "id": "backend-abc123",
    "hostname": "backend-abc123",
    "digitalocean": {
      "app_id": "your-app-id",
      "region": "lon1",
      "deployment_id": "deployment-123"
    }
  },
  "system": {
    "cpu_percent": 15.5,
    "memory": {
      "percent": 45.2
    }
  }
}
```

#### `/api/v1/health/instances`
List all active instances:
```json
{
  "desired_replicas": 2,
  "active_instances": 2,
  "registered_instances": [
    {
      "instance_id": "backend-abc123",
      "last_heartbeat": "2024-01-15T10:00:00Z",
      "is_stale": false
    }
  ]
}
```

#### `/api/v1/monitoring/replicas`
Comprehensive replica status with recommendations:
```json
{
  "summary": {
    "configured_replicas": 2,
    "active_instances": 2,
    "status": "healthy"
  },
  "recommendations": [
    "✓ Instance count matches configuration - no action needed"
  ]
}
```

### 3. DigitalOcean API Integration

Direct API access for accurate information:
- Real-time app configuration
- Deployment status
- Actual vs desired replica counts

## Configuration

### Required Environment Variables

```bash
# For full monitoring capabilities
DO_API_TOKEN=your-digitalocean-api-token
DO_APP_ID=your-app-id
DESIRED_REPLICAS=2

# These are auto-populated by DigitalOcean
DO_REGION=lon1
DO_DEPLOYMENT_ID=current-deployment-id
DO_COMPONENT_NAME=backend
```

### Getting Your DigitalOcean API Token

1. Go to [DigitalOcean API Tokens](https://cloud.digitalocean.com/account/api/tokens)
2. Click "Generate New Token"
3. Name: "Fynlo Monitoring"
4. Scopes: Read access for Apps
5. Copy the token and add to your environment

### Finding Your App ID

```bash
# List all apps
doctl apps list

# Get app ID from the output
# ID                                    NAME           STATUS    CREATED AT
# abc123-def456-789012                  fynlo-backend  active    2024-01-01 10:00:00
```

## Verification Steps

### 1. Check Actual Instances

```bash
# Using the API
curl https://api.fynlo.com/api/v1/health/instances \
  -H "Authorization: Bearer YOUR_TOKEN"

# Using DigitalOcean CLI
doctl apps get $APP_ID --format Spec.Services
```

### 2. Monitor Health Endpoint

```bash
# Watch instance health
watch -n 5 'curl -s https://api.fynlo.com/api/v1/monitoring/replicas | jq .summary'
```

### 3. Force Refresh (Platform Owners Only)

```bash
# Refresh monitoring data
curl -X POST https://api.fynlo.com/api/v1/monitoring/replicas/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: Extra Instances Showing

If monitoring shows more instances than configured:

1. **Check for stuck deployments**:
   ```bash
   doctl apps list-deployments $APP_ID
   ```

2. **Force scale reset**:
   ```bash
   # Scale down to 0
   doctl apps update $APP_ID --spec - <<EOF
   services:
     - name: backend
       instance_count: 0
   EOF
   
   # Wait 30 seconds
   sleep 30
   
   # Scale back up
   doctl apps update $APP_ID --spec - <<EOF
   services:
     - name: backend
       instance_count: 2
   EOF
   ```

3. **Use the refresh endpoint** to clean up stale instances

### Issue: Missing Instances

If monitoring shows fewer instances than configured:

1. **Check deployment logs**:
   ```bash
   doctl apps logs $APP_ID --type=deploy
   ```

2. **Verify health checks are passing**:
   ```bash
   curl https://api.fynlo.com/api/v1/health/ready
   ```

3. **Check for deployment failures** in the DigitalOcean dashboard

### Issue: No Monitoring Data

If monitoring endpoints return no data:

1. **Verify Redis connection**:
   - Check Redis is accessible
   - Ensure REDIS_URL is correctly configured

2. **Check instance tracker logs**:
   ```bash
   doctl apps logs $APP_ID | grep "instance tracker"
   ```

3. **Verify environment variables** are set correctly

## Monitoring Best Practices

### 1. Regular Health Checks

Set up external monitoring to track the actual instance count:

```bash
# Example monitoring script
#!/bin/bash
ENDPOINT="https://api.fynlo.com/api/v1/monitoring/replicas"
TOKEN="your-token"

RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" $ENDPOINT)
ACTIVE=$(echo $RESPONSE | jq -r '.data.summary.active_instances')
CONFIGURED=$(echo $RESPONSE | jq -r '.data.summary.configured_replicas')

if [ "$ACTIVE" != "$CONFIGURED" ]; then
  echo "ALERT: Instance mismatch - Active: $ACTIVE, Configured: $CONFIGURED"
  # Send alert via webhook/email
fi
```

### 2. Grafana Dashboard

Create a dashboard with these metrics:
- Active instance count
- Configured replica count
- Instance health by ID
- Deployment history

### 3. Alerting Rules

Set up alerts for:
- Instance count mismatch for > 5 minutes
- Stale instances detected
- Failed health checks

## API Reference

### Authentication

All monitoring endpoints require authentication:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Endpoints

| Endpoint | Method | Description | Required Role |
|----------|---------|-------------|---------------|
| `/api/v1/health/detailed` | GET | Detailed health of current instance | Any authenticated user |
| `/api/v1/health/instances` | GET | List all instances | Any authenticated user |
| `/api/v1/health/ready` | GET | Readiness probe | No auth required |
| `/api/v1/health/live` | GET | Liveness probe | No auth required |
| `/api/v1/monitoring/replicas` | GET | Comprehensive replica status | Any authenticated user |
| `/api/v1/monitoring/metrics` | GET | DigitalOcean metrics | Platform owner |
| `/api/v1/monitoring/replicas/refresh` | POST | Force refresh | Platform owner |
| `/api/v1/monitoring/deployments` | GET | Deployment history | Platform owner |

## Migration Notes

When deploying this monitoring solution:

1. **Add environment variables** before deployment
2. **Deploy the new code** with monitoring endpoints
3. **Wait for instances to register** (up to 30 seconds)
4. **Verify monitoring** is working correctly
5. **Set up external monitoring** using the endpoints

## Known Limitations

1. **Historical data**: Only current instance state is tracked
2. **Dashboard accuracy**: DigitalOcean dashboard may still show incorrect counts
3. **Network partitions**: Brief network issues may show instances as stale
4. **Redis dependency**: Monitoring requires Redis to be available

## Future Improvements

1. **Metrics storage**: Store historical instance counts
2. **Auto-remediation**: Automatically fix discrepancies
3. **Webhook notifications**: Real-time alerts for issues
4. **Prometheus integration**: Export metrics for external monitoring