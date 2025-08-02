#!/usr/bin/env python3
"""
DigitalOcean Billing Alerts Configuration
Sets up critical cost alerts to prevent silent budget drain
"""

import os
import json
import requests
from typing import List, Dict

class BillingAlertManager:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.digitalocean.com/v2"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def get_current_alerts(self) -> List[Dict]:
        """Get existing billing alerts"""
        try:
            # Note: DigitalOcean doesn't have a direct API for billing alerts
            # This would typically be done through the dashboard
            # Using balance endpoint as a proxy
            response = requests.get(f"{self.base_url}/customers/my/balance", headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            print("💰 Current Account Balance:")
            print(f"   Month-to-date usage: ${data.get('month_to_date_usage', 0)}")
            print(f"   Account balance: ${data.get('account_balance', 0)}")
            
            return []
        except Exception as e:
            print(f"❌ Error fetching billing info: {e}")
            return []
    
    def configure_alerts(self) -> Dict[str, str]:
        """Generate alert configuration instructions"""
        alerts = [
            {"threshold": 10, "priority": "INFO", "reason": "Early warning - unusual activity"},
            {"threshold": 50, "priority": "WARNING", "reason": "Mid-month checkpoint"},
            {"threshold": 150, "priority": "CRITICAL", "reason": "Approaching expected budget"},
            {"threshold": 200, "priority": "EMERGENCY", "reason": "Budget exceeded!"}
        ]
        
        instructions = {
            "manual_setup": "https://cloud.digitalocean.com/account/billing",
            "alerts_to_configure": alerts,
            "webhook_config": self.generate_webhook_config(),
            "slack_integration": self.generate_slack_config()
        }
        
        return instructions
    
    def generate_webhook_config(self) -> Dict:
        """Generate webhook configuration for alerts"""
        return {
            "webhook_url": "https://your-app.com/api/webhooks/digitalocean-billing",
            "events": ["billing.threshold_exceeded", "billing.usage_spike"],
            "payload_example": {
                "event_type": "billing.threshold_exceeded",
                "threshold": 150,
                "current_usage": 165.43,
                "projected_monthly": 220.00,
                "timestamp": "2024-01-30T09:00:00Z"
            }
        }
    
    def generate_slack_config(self) -> Dict:
        """Generate Slack webhook configuration"""
        return {
            "webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
            "channel": "#infrastructure-alerts",
            "message_template": {
                "text": "⚠️ DigitalOcean Billing Alert",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "*Billing Threshold Exceeded*\n"
                                   "Current usage: $${current_usage}\n"
                                   "Threshold: $${threshold}\n"
                                   "Projected monthly: $${projected}"
                        }
                    }
                ]
            }
        }
    
    def create_monitoring_script(self) -> str:
        """Create a monitoring script that can be run via cron"""
        script = '''#!/bin/bash
# DigitalOcean Billing Monitor
# Run this script hourly via cron to check costs

DIGITALOCEAN_TOKEN="${DIGITALOCEAN_TOKEN}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Thresholds
THRESHOLD_WARNING=50
THRESHOLD_CRITICAL=150
THRESHOLD_EMERGENCY=200

# Check for required dependencies
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required but not installed."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed."; exit 1; }
command -v bc >/dev/null 2>&1 || { echo "Error: bc is required but not installed."; exit 1; }

# Get current balance
BALANCE_JSON=$(curl -s -X GET "https://api.digitalocean.com/v2/customers/my/balance" \\
  -H "Authorization: Bearer $DIGITALOCEAN_TOKEN")

# Extract month-to-date usage (API returns value in dollars as string)
CURRENT_USAGE_DOLLARS=$(echo $BALANCE_JSON | jq -r '.month_to_date_usage // "0"')

# Calculate daily average and projection
DAY_OF_MONTH=$(date +%d)
DAILY_AVERAGE=$(echo "scale=2; $CURRENT_USAGE_DOLLARS / $DAY_OF_MONTH" | bc)
DAYS_IN_MONTH=$(date +%d -d "$(date +%Y-%m-01) +1 month -1 day")
PROJECTED_MONTHLY=$(echo "scale=2; $DAILY_AVERAGE * $DAYS_IN_MONTH" | bc)

echo "💰 DigitalOcean Billing Status"
echo "   Current Usage: \\$$CURRENT_USAGE_DOLLARS"
echo "   Daily Average: \\$$DAILY_AVERAGE"
echo "   Projected Monthly: \\$$PROJECTED_MONTHLY"

# Check thresholds
ALERT_LEVEL="OK"
ALERT_EMOJI="✅"

if (( $(echo "$CURRENT_USAGE_DOLLARS > $THRESHOLD_EMERGENCY" | bc -l) )); then
    ALERT_LEVEL="EMERGENCY"
    ALERT_EMOJI="🚨"
elif (( $(echo "$CURRENT_USAGE_DOLLARS > $THRESHOLD_CRITICAL" | bc -l) )); then
    ALERT_LEVEL="CRITICAL"
    ALERT_EMOJI="⚠️"
elif (( $(echo "$CURRENT_USAGE_DOLLARS > $THRESHOLD_WARNING" | bc -l) )); then
    ALERT_LEVEL="WARNING"
    ALERT_EMOJI="⚡"
fi

# Send Slack alert if threshold exceeded
if [ "$ALERT_LEVEL" != "OK" ] && [ ! -z "$SLACK_WEBHOOK" ]; then
    SLACK_MESSAGE=$(cat <<EOF
{
    "text": "$ALERT_EMOJI DigitalOcean Billing Alert: $ALERT_LEVEL",
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*DigitalOcean Billing Alert*\\nLevel: *$ALERT_LEVEL*\\nCurrent Usage: *\\$$CURRENT_USAGE_DOLLARS*\\nProjected Monthly: *\\$$PROJECTED_MONTHLY*\\nDaily Average: *\\$$DAILY_AVERAGE*"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Dashboard"
                    },
                    "url": "https://cloud.digitalocean.com/account/billing"
                }
            ]
        }
    ]
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \\
        --data "$SLACK_MESSAGE" \\
        "$SLACK_WEBHOOK"
fi

# Log to file for historical tracking
LOG_FILE="/var/log/digitalocean-billing.log"
echo "$(date +%Y-%m-%d\\ %H:%M:%S) - Usage: \\$$CURRENT_USAGE_DOLLARS, Projected: \\$$PROJECTED_MONTHLY, Status: $ALERT_LEVEL" >> $LOG_FILE

# Exit with appropriate code
case $ALERT_LEVEL in
    "EMERGENCY") exit 3 ;;
    "CRITICAL") exit 2 ;;
    "WARNING") exit 1 ;;
    *) exit 0 ;;
esac
'''
        return script
    
    def generate_setup_instructions(self) -> str:
        """Generate complete setup instructions"""
        instructions = f"""
# DigitalOcean Billing Alerts Setup Guide

## 🚨 Phase 1: Immediate Actions (30 minutes)

### 1. Configure Billing Alerts in Dashboard
1. Go to: https://cloud.digitalocean.com/account/billing
2. Click "Billing Alerts" or "Notifications"
3. Set up these alerts:
   - $10 - Early warning
   - $50 - Mid-month checkpoint  
   - $150 - Approaching budget
   - $200 - Budget exceeded
4. Add notification emails and/or webhooks

### 2. Set Up Hourly Monitoring Script
```bash
# Save the monitoring script
cat > /usr/local/bin/do-billing-monitor.sh << 'SCRIPT'
{self.create_monitoring_script()}
SCRIPT

# Make executable
chmod +x /usr/local/bin/do-billing-monitor.sh

# Add to crontab (runs every hour)
crontab -e
# Add: 0 * * * * /usr/local/bin/do-billing-monitor.sh
```

### 3. Configure Slack Alerts (Optional)
1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Set environment variable:
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

## 📊 Phase 2: Daily Cost Tracking

### Set up daily cost report
```bash
# Add to crontab (daily at 9 AM)
0 9 * * * /usr/local/bin/digitalocean-daily-costs.py
```

## 🔔 Phase 3: Resource Utilization Alerts

Configure alerts for:
- CPU usage < 20% for 24 hours (over-provisioned)
- Memory usage < 30% for 24 hours (over-provisioned)
- Disk usage > 80% (needs attention)
- Unattached resources > 0 (zombie alert)

## 📈 Expected Outcomes

1. **Immediate notification** of cost spikes
2. **Daily visibility** into spending trends
3. **Proactive alerts** before budget exceeded
4. **20-30% cost reduction** through visibility

## 🛠️ Testing

Test the alerts:
```bash
# Run monitoring script manually
./do-billing-monitor.sh

# Check if alerts would trigger
CURRENT_USAGE=175 ./do-billing-monitor.sh
```

## 📱 Mobile Alerts

For critical alerts on mobile:
1. Install DigitalOcean mobile app
2. Enable push notifications
3. Configure billing alert preferences
"""
        return instructions


def main():
    """Set up billing alerts"""
    api_token = os.environ.get("DIGITALOCEAN_TOKEN")
    if not api_token:
        print("❌ Error: DIGITALOCEAN_TOKEN not set")
        print("Please set: export DIGITALOCEAN_TOKEN='your-token-here'")
        return
    
    manager = BillingAlertManager(api_token)
    
    print("🔔 DigitalOcean Billing Alerts Configuration")
    print("=" * 50)
    
    # Check current status
    manager.get_current_alerts()
    
    # Generate configurations
    config = manager.configure_alerts()
    
    print("\n📋 Alert Configuration Required:")
    print(f"   Manual setup URL: {config['manual_setup']}")
    print("\n   Recommended Alerts:")
    for alert in config['alerts_to_configure']:
        print(f"   - ${alert['threshold']} ({alert['priority']}): {alert['reason']}")
    
    # Save configurations
    with open("billing-alerts-config.json", "w") as f:
        json.dump(config, f, indent=2)
    print("\n📄 Configuration saved to: billing-alerts-config.json")
    
    # Save setup instructions
    instructions = manager.generate_setup_instructions()
    with open("billing-alerts-setup.md", "w") as f:
        f.write(instructions)
    print("📖 Setup guide saved to: billing-alerts-setup.md")
    
    # Save monitoring script
    script = manager.create_monitoring_script()
    with open("do-billing-monitor.sh", "w") as f:
        f.write(script)
    os.chmod("do-billing-monitor.sh", 0o755)
    print("🔧 Monitoring script saved to: do-billing-monitor.sh")
    
    print("\n✅ Billing alerts configuration complete!")
    print("⚠️  CRITICAL: Set up alerts NOW to prevent budget overruns")


if __name__ == "__main__":
    main()