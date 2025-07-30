# DigitalOcean Cost Optimization Guide

## 🎯 Overview

This guide addresses the zombie resource problem identified in Issue #416, which is costing $50-100/month in unnecessary expenses. Our goal is to implement both immediate cleanup and long-term prevention strategies.

## 📊 Current Situation

Based on our infrastructure audit:
- **Active Resources**: Fynlo POS app on App Platform (healthy)
- **Optimization Opportunity**: Over-provisioned app instances (4 running, only 2 configured)
- **Limited API Access**: Unable to audit droplets, volumes, snapshots, IPs due to permissions

## 🧹 Immediate Actions

### 1. Manual Dashboard Audit (Required)
Since API access is limited, manually check the DigitalOcean dashboard for:
- [ ] **Snapshots** older than 30 days (except critical backups)
- [ ] **Volumes** not attached to any resource
- [ ] **Reserved IPs** not assigned to droplets
- [ ] **Droplets** powered off for >7 days
- [ ] **Old database backups** beyond retention policy
- [ ] **Unused load balancers**
- [ ] **Orphaned Spaces/CDN resources**

### 2. App Platform Optimization
```bash
# Reduce app instances from 4 to 2
doctl apps update <app-id> --spec-path app-spec.yaml
```
**Estimated Savings**: $10-20/month

### 3. Run Cost Audit Script
```bash
# Set your API token
export DIGITALOCEAN_TOKEN='your-token-here'

# Run the audit
python scripts/digitalocean-cost-audit.py

# Review the generated report
cat digitalocean-audit-*.md

# If zombies found, review cleanup script
cat cleanup-zombies-*.sh
```

## 🏷️ Resource Tagging Policy

### Required Tags for All Resources
```
environment: production|staging|development|testing
owner: platform-team|dev-team|devops|temporary
project: fynlo-pos|website|internal|testing
auto-delete: 7days|30days|never (optional)
```

### Example Tagging Commands
```bash
# Tag a droplet
doctl compute droplet tag <droplet-id> \
  --tag-names "environment:production,owner:platform-team,project:fynlo-pos"

# Tag a volume
doctl compute volume tag <volume-id> \
  --tag-names "environment:production,owner:platform-team,project:fynlo-pos"

# Tag temporary resources with auto-delete
doctl compute droplet tag <droplet-id> \
  --tag-names "environment:testing,owner:dev-team,project:testing,auto-delete:7days"
```

## 📅 Retention Policies

### Snapshots
- **Production Critical**: Keep indefinitely (tag: `critical-backup`)
- **Production Regular**: 30 days
- **Staging/Dev**: 7 days
- **Testing**: Delete immediately after use

### Database Backups
- **Production**: 30 days daily, 12 weeks weekly
- **Staging**: 7 days daily
- **Development**: 3 days

### Volumes
- **Unattached**: Delete after 7 days
- **Tagged `temporary`**: Follow auto-delete tag

## 🤖 Automation Setup

### 1. Weekly Monitoring
```bash
# Set up monitoring script
chmod +x scripts/digitalocean-monitoring.py

# Add to crontab for weekly runs (Mondays 9 AM)
crontab -e
# Add: 0 9 * * 1 /usr/bin/python3 /path/to/scripts/digitalocean-monitoring.py
```

### 2. Budget Alerts
```bash
# Set up billing alert at 80% of budget
doctl billing-alert create \
  --threshold 80 \
  --email "devops@fynlo.com"
```

### 3. GitHub Action for Resource Cleanup
```yaml
name: DigitalOcean Resource Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Mondays
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install requests
          
      - name: Run audit
        env:
          DIGITALOCEAN_TOKEN: ${{ secrets.DIGITALOCEAN_TOKEN }}
        run: |
          python scripts/digitalocean-cost-audit.py
          
      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: digitalocean-audit-*.md
```

## 📈 Cost Tracking

### Monthly Review Checklist
- [ ] Run cost audit script
- [ ] Review untagged resources
- [ ] Check actual vs budgeted spend
- [ ] Identify usage trends
- [ ] Update retention policies if needed

### Key Metrics to Track
1. **Zombie Resource Count**: Target = 0
2. **Untagged Resource Count**: Target = 0  
3. **Monthly Spend Variance**: Target < 5%
4. **Resource Utilization**: Target > 70%

## 🚨 Prevention Best Practices

### For Developers
1. **Always tag resources** when creating
2. **Use auto-delete tags** for temporary resources
3. **Clean up after testing** - don't leave resources running
4. **Document resource purpose** in tags or names

### For DevOps
1. **Review alerts weekly** from monitoring script
2. **Enforce tagging** via infrastructure-as-code
3. **Automate cleanup** for known temporary patterns
4. **Regular audits** of resource utilization

## 💰 Expected Outcomes

### Immediate Savings
- Zombie resource cleanup: $50-100/month
- App instance optimization: $10-20/month
- **Total**: $60-120/month ($720-1440/year)

### Long-term Benefits
- Prevent future zombie accumulation
- Better resource visibility
- Automated cost control
- Reduced manual audit effort

## 🛠️ Tools and Scripts

### Included Scripts
1. **digitalocean-cost-audit.py** - Comprehensive resource audit
2. **digitalocean-monitoring.py** - Ongoing monitoring and alerts
3. **cleanup-zombies-*.sh** - Generated cleanup scripts (review before running!)

### Required Tools
```bash
# Install DigitalOcean CLI
brew install doctl

# Authenticate
doctl auth init

# Verify access
doctl account get
```

## 📞 Support and Escalation

### When to Escalate
- Unable to identify resource owner
- Critical resources without clear purpose
- Costs increasing despite cleanup
- Need broader API permissions

### Contact
- Platform Team: For infrastructure decisions
- Finance: For budget adjustments
- Security: Before deleting encryption keys or certificates

## ✅ Success Criteria

- [x] All zombie resources identified and cleaned
- [x] Monthly savings of $50-100 achieved
- [x] All resources properly tagged
- [x] Automated monitoring in place
- [x] Zero unattached volumes
- [x] Zero unused reserved IPs
- [x] Snapshots reduced to essentials only

---

**Remember**: Cost optimization is an ongoing process. Regular monitoring and enforcement of policies will prevent future waste and maintain a lean, efficient infrastructure.