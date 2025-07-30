#!/usr/bin/env python3
"""
DigitalOcean Daily Cost Tracker with Spike Detection
Tracks daily costs and alerts on unusual spending patterns
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import statistics

class DailyCostTracker:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.digitalocean.com/v2"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        self.history_file = "digitalocean-cost-history.json"
        self.spike_threshold = 1.5  # 50% increase triggers alert
    
    def get_current_costs(self) -> Dict:
        """Get current billing information"""
        try:
            response = requests.get(f"{self.base_url}/customers/my/balance", headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            # Get current date info
            today = datetime.now()
            day_of_month = today.day
            days_in_month = (datetime(today.year, today.month + 1, 1) - timedelta(days=1)).day if today.month < 12 else 31
            
            # Calculate metrics
            mtd_usage = float(data.get('month_to_date_usage', '0'))
            daily_average = mtd_usage / day_of_month if day_of_month > 0 else 0
            projected_monthly = daily_average * days_in_month
            
            return {
                "date": today.strftime("%Y-%m-%d"),
                "month_to_date": mtd_usage,
                "daily_average": round(daily_average, 2),
                "projected_monthly": round(projected_monthly, 2),
                "day_of_month": day_of_month,
                "account_balance": float(data.get('account_balance', '0'))
            }
        except Exception as e:
            print(f"❌ Error fetching costs: {e}")
            return {}
    
    def load_history(self) -> List[Dict]:
        """Load historical cost data"""
        if os.path.exists(self.history_file):
            with open(self.history_file, 'r') as f:
                return json.load(f)
        return []
    
    def save_history(self, history: List[Dict]):
        """Save historical cost data"""
        # Keep last 90 days of history
        cutoff_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        history = [h for h in history if h["date"] >= cutoff_date]
        
        with open(self.history_file, 'w') as f:
            json.dump(history, f, indent=2)
    
    def detect_spike(self, current: Dict, history: List[Dict]) -> Tuple[bool, Dict]:
        """Detect unusual cost spikes"""
        if len(history) < 7:  # Need at least a week of data
            return False, {}
        
        # Get last 7 days of daily averages
        recent_averages = [h["daily_average"] for h in history[-7:]]
        avg_daily_cost = statistics.mean(recent_averages)
        std_dev = statistics.stdev(recent_averages) if len(recent_averages) > 1 else 0
        
        # Calculate today's actual spend
        yesterday = history[-1] if history else {"month_to_date": 0, "date": ""}
        
        # Check if we're in the same month
        current_month = current["date"][:7]  # YYYY-MM
        yesterday_month = yesterday.get("date", "")[:7]
        
        if current_month == yesterday_month:
            # Same month - normal calculation
            today_spend = current["month_to_date"] - yesterday.get("month_to_date", 0)
        else:
            # New month - today's spend is just the current month-to-date
            today_spend = current["month_to_date"]
        
        # Detect spike
        spike_detected = False
        spike_info = {
            "today_spend": round(today_spend, 2),
            "average_daily": round(avg_daily_cost, 2),
            "std_deviation": round(std_dev, 2),
            "spike_ratio": round(today_spend / avg_daily_cost, 2) if avg_daily_cost > 0 else 0
        }
        
        # Multiple spike detection criteria
        if avg_daily_cost > 0:
            if today_spend > avg_daily_cost * self.spike_threshold:
                spike_detected = True
                spike_info["reason"] = f"Today's spend (${today_spend:.2f}) is {spike_info['spike_ratio']}x the average"
            elif today_spend > avg_daily_cost + (2 * std_dev) and std_dev > 0:
                spike_detected = True
                spike_info["reason"] = f"Today's spend exceeds 2 standard deviations from mean"
        
        return spike_detected, spike_info
    
    def analyze_trends(self, history: List[Dict]) -> Dict:
        """Analyze spending trends"""
        if len(history) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate week-over-week change
        if len(history) >= 14:
            last_week_avg = statistics.mean([h["daily_average"] for h in history[-7:]])
            prev_week_avg = statistics.mean([h["daily_average"] for h in history[-14:-7]])
            week_change = ((last_week_avg - prev_week_avg) / prev_week_avg * 100) if prev_week_avg > 0 else 0
        else:
            week_change = 0
        
        # Calculate month-over-month projection
        current_projection = history[-1]["projected_monthly"] if history else 0
        
        # Find same day last month
        last_month_data = None
        target_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        for h in history:
            if h["date"] <= target_date:
                last_month_data = h
                break
        
        month_change = 0
        if last_month_data:
            month_change = ((current_projection - last_month_data["projected_monthly"]) / 
                           last_month_data["projected_monthly"] * 100) if last_month_data["projected_monthly"] > 0 else 0
        
        return {
            "trend": "increasing" if week_change > 5 else "decreasing" if week_change < -5 else "stable",
            "week_over_week_change": round(week_change, 1),
            "month_over_month_change": round(month_change, 1),
            "current_projection": current_projection
        }
    
    def identify_cost_drivers(self) -> List[Dict]:
        """Identify which resources are driving costs"""
        cost_drivers = []
        
        # Check App Platform
        try:
            apps_response = requests.get(f"{self.base_url}/apps", headers=self.headers)
            if apps_response.status_code == 200:
                apps = apps_response.json().get("apps", [])
                for app in apps:
                    # Estimate cost based on instance count and size
                    total_instances = sum(service.get("instance_count", 1) 
                                        for service in app.get("spec", {}).get("services", []))
                    estimated_cost = total_instances * 10  # Rough estimate
                    cost_drivers.append({
                        "type": "App Platform",
                        "name": app.get("spec", {}).get("name", "Unknown"),
                        "estimated_monthly_cost": estimated_cost,
                        "details": f"{total_instances} instances"
                    })
        except:
            pass
        
        # Check Databases
        try:
            db_response = requests.get(f"{self.base_url}/databases", headers=self.headers)
            if db_response.status_code == 200:
                databases = db_response.json().get("databases", [])
                for db in databases:
                    # Estimate based on size
                    size = db.get("size", "unknown")
                    if "1gb" in size.lower():
                        estimated_cost = 15
                    elif "2gb" in size.lower():
                        estimated_cost = 25
                    else:
                        estimated_cost = 50
                    
                    cost_drivers.append({
                        "type": "Database",
                        "name": db.get("name", "Unknown"),
                        "estimated_monthly_cost": estimated_cost,
                        "details": f"{db.get('engine', 'Unknown')} - {size}"
                    })
        except:
            pass
        
        # Sort by cost
        cost_drivers.sort(key=lambda x: x["estimated_monthly_cost"], reverse=True)
        return cost_drivers[:10]  # Top 10 cost drivers
    
    def generate_daily_report(self, current: Dict, spike_detected: bool, 
                            spike_info: Dict, trends: Dict, cost_drivers: List[Dict]) -> str:
        """Generate daily cost report"""
        report = [
            f"# DigitalOcean Daily Cost Report",
            f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 💰 Current Costs",
            f"- **Month-to-date**: ${current['month_to_date']:.2f}",
            f"- **Daily average**: ${current['daily_average']:.2f}",
            f"- **Projected monthly**: ${current['projected_monthly']:.2f}",
            f"- **Day of month**: {current['day_of_month']}",
            ""
        ]
        
        # Spike detection
        if spike_detected:
            report.extend([
                "## 🚨 COST SPIKE DETECTED!",
                f"- **Today's spend**: ${spike_info['today_spend']:.2f}",
                f"- **Normal daily average**: ${spike_info['average_daily']:.2f}",
                f"- **Spike ratio**: {spike_info['spike_ratio']}x normal",
                f"- **Reason**: {spike_info.get('reason', 'Unknown')}",
                ""
            ])
        else:
            report.append("## ✅ No unusual spending detected\n")
        
        # Trends
        report.extend([
            "## 📈 Spending Trends",
            f"- **Trend**: {trends['trend'].title()}",
            f"- **Week-over-week**: {'+' if trends['week_over_week_change'] > 0 else ''}{trends['week_over_week_change']}%",
            f"- **Month-over-month**: {'+' if trends['month_over_month_change'] > 0 else ''}{trends['month_over_month_change']}%",
            ""
        ])
        
        # Cost drivers
        if cost_drivers:
            report.append("## 🎯 Top Cost Drivers")
            total_identified = sum(d["estimated_monthly_cost"] for d in cost_drivers)
            for driver in cost_drivers[:5]:
                percentage = (driver["estimated_monthly_cost"] / total_identified * 100) if total_identified > 0 else 0
                report.append(f"- **{driver['name']}** ({driver['type']}): ~${driver['estimated_monthly_cost']}/month ({percentage:.1f}%)")
                report.append(f"  - {driver['details']}")
        
        # Recommendations
        report.extend([
            "",
            "## 💡 Recommendations"
        ])
        
        if spike_detected:
            report.append("1. **URGENT**: Investigate today's cost spike immediately")
            report.append("2. Check for new resources created today")
            report.append("3. Review recent deployments and scaling changes")
        elif trends["trend"] == "increasing":
            report.append("1. Review resource utilization for over-provisioning")
            report.append("2. Check for unused resources that can be removed")
            report.append("3. Consider implementing auto-scaling where appropriate")
        else:
            report.append("1. Continue monitoring for optimization opportunities")
            report.append("2. Maintain current cost control practices")
        
        # Budget status
        budget_limit = 200  # Configure your budget
        budget_used_percent = (current['month_to_date'] / budget_limit * 100) if budget_limit > 0 else 0
        days_remaining = 30 - current['day_of_month']
        daily_budget_remaining = (budget_limit - current['month_to_date']) / days_remaining if days_remaining > 0 else 0
        
        report.extend([
            "",
            "## 📊 Budget Status",
            f"- **Budget limit**: ${budget_limit}",
            f"- **Used**: ${current['month_to_date']:.2f} ({budget_used_percent:.1f}%)",
            f"- **Remaining**: ${budget_limit - current['month_to_date']:.2f}",
            f"- **Daily budget for rest of month**: ${daily_budget_remaining:.2f}",
            ""
        ])
        
        if budget_used_percent > 80:
            report.append("⚠️ **WARNING**: Over 80% of budget consumed!")
        elif current['projected_monthly'] > budget_limit:
            report.append("⚠️ **WARNING**: Projected to exceed budget!")
        
        return "\n".join(report)
    
    def send_alert(self, report: str, spike_detected: bool):
        """Send alert via configured channels"""
        if spike_detected:
            print("\n🚨 SENDING COST SPIKE ALERT!")
        
        # Log to file
        with open(f"cost-report-{datetime.now().strftime('%Y-%m-%d')}.md", "w") as f:
            f.write(report)
        
        # Send to Slack if configured
        slack_webhook = os.environ.get("SLACK_WEBHOOK_URL")
        if slack_webhook and spike_detected:
            alert_data = {
                "text": "🚨 DigitalOcean Cost Spike Detected!",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Cost spike detected in DigitalOcean spending. Check the daily report for details."
                        }
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {"type": "plain_text", "text": "View Dashboard"},
                                "url": "https://cloud.digitalocean.com/account/billing"
                            }
                        ]
                    }
                ]
            }
            try:
                requests.post(slack_webhook, json=alert_data)
            except:
                pass


def main():
    """Run daily cost tracking"""
    api_token = os.environ.get("DIGITALOCEAN_TOKEN")
    if not api_token:
        print("❌ Error: DIGITALOCEAN_TOKEN not set")
        return
    
    tracker = DailyCostTracker(api_token)
    
    print("📊 DigitalOcean Daily Cost Tracker")
    print("=" * 50)
    
    # Get current costs
    current = tracker.get_current_costs()
    if not current:
        print("❌ Failed to fetch current costs")
        return
    
    # Load history
    history = tracker.load_history()
    
    # Detect spikes
    spike_detected, spike_info = tracker.detect_spike(current, history)
    
    # Analyze trends
    trends = tracker.analyze_trends(history + [current])
    
    # Identify cost drivers
    cost_drivers = tracker.identify_cost_drivers()
    
    # Generate report
    report = tracker.generate_daily_report(current, spike_detected, spike_info, trends, cost_drivers)
    
    # Save current data to history
    history.append(current)
    tracker.save_history(history)
    
    # Output report
    print(report)
    
    # Send alerts
    tracker.send_alert(report, spike_detected)
    
    print(f"\n📄 Report saved to: cost-report-{datetime.now().strftime('%Y-%m-%d')}.md")
    
    if spike_detected:
        exit(1)  # Exit with error code to trigger monitoring alerts


if __name__ == "__main__":
    main()