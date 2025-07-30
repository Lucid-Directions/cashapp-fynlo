# Cost Monitoring Implementation Plan - Issue #417

## Overview
Implement comprehensive cost monitoring and alerts for DigitalOcean infrastructure to prevent silent budget drain and provide visibility into costs.

## Current Analysis
Based on my review of the codebase:

### Existing Resources:
1. **Scripts Available:**
   - `/scripts/digitalocean-cost-audit.py` - Identifies zombie resources and calculates savings
   - `/scripts/digitalocean-monitoring.py` - Monitors resource tagging and retention policies
   
2. **Backend Services:**
   - `backend/app/services/digitalocean_monitor.py` - App Platform monitoring
   - `backend/app/api/v1/endpoints/monitoring.py` - API endpoints for monitoring

3. **Missing Components:**
   - No billing alerts configured
   - No daily cost tracking
   - No automated cost reports
   - No real-time cost monitoring dashboard
   - No Slack/email notifications for cost spikes

## Implementation Tasks

### Phase 1: Billing Alerts Setup (Priority: CRITICAL)
- [ ] Create script to configure DigitalOcean billing alerts via API
- [ ] Set up progressive threshold alerts ($10, $50, $150, $200)
- [ ] Configure email recipients for each alert level
- [ ] Test alert notifications

### Phase 2: Resource Monitoring Alerts
- [ ] Implement database CPU monitoring (>70% and <20%)
- [ ] Set up App Platform memory alerts (>80%)
- [ ] Configure network bandwidth alerts
- [ ] Create resource underutilization alerts

### Phase 3: Daily Cost Tracking
- [ ] Create daily cost tracker script
- [ ] Implement cost spike detection (>20% increase)
- [ ] Store historical cost data
- [ ] Generate daily cost reports

### Phase 4: Automated Reporting
- [ ] Set up weekly cost report generation
- [ ] Implement cost allocation by service/tag
- [ ] Create cost per restaurant metric
- [ ] Configure email/Slack notifications

### Phase 5: Real-time Dashboard
- [ ] Create cost monitoring API endpoints
- [ ] Build frontend dashboard components
- [ ] Implement cost projections
- [ ] Add resource optimization suggestions

### Phase 6: Cost Prevention
- [ ] Enforce resource tagging policy
- [ ] Implement automatic cleanup for tagged resources
- [ ] Create pre-deployment cost estimation
- [ ] Set up budget enforcement rules

## Technical Implementation Details

### 1. Billing Alert Configuration Script
```python
# scripts/setup-billing-alerts.py
- Use DigitalOcean API to create billing alerts
- Configure multiple thresholds
- Set up notification channels
- Validate alert creation
```

### 2. Cost Monitoring Service
```python
# backend/app/services/cost_monitor.py
- Daily cost tracking
- Historical data storage
- Spike detection algorithms
- Alert triggering logic
```

### 3. API Endpoints
```python
# backend/app/api/v1/endpoints/billing.py
- GET /api/v1/billing/current - Current month costs
- GET /api/v1/billing/history - Historical costs
- GET /api/v1/billing/alerts - Alert configuration
- POST /api/v1/billing/alerts - Configure alerts
```

### 4. Database Schema
```sql
-- billing_history table
- date
- total_cost
- cost_by_service (JSON)
- cost_by_tag (JSON)
- alert_triggered

-- cost_alerts table
- threshold
- recipients
- enabled
- last_triggered
```

## Success Criteria
- [ ] All billing alerts configured and tested
- [ ] Resource utilization alerts active
- [ ] Daily cost tracking script deployed
- [ ] Weekly automated reports running
- [ ] All resources properly tagged
- [ ] Cost dashboard accessible to team
- [ ] Slack notifications for cost spikes

## Timeline
- Phase 1: 2 hours (IMMEDIATE)
- Phase 2: 2 hours
- Phase 3: 3 hours
- Phase 4: 3 hours
- Phase 5: 4 hours
- Phase 6: 2 hours
- Total: ~16 hours

## Next Steps
1. Get confirmation to proceed
2. Start with Phase 1 (billing alerts) immediately
3. Deploy monitoring infrastructure
4. Test all alert mechanisms
5. Document response procedures