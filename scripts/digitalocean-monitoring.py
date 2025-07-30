#!/usr/bin/env python3
"""
DigitalOcean Resource Monitoring and Tagging Script
Implements continuous monitoring and prevention strategies
"""

import os
import json
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from typing import Dict, List, Set
import requests
import schedule
import time

class ResourceMonitor:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.digitalocean.com/v2"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        self.required_tags = {"environment", "owner", "project"}
        self.tag_policy = {
            "environment": ["production", "staging", "development", "testing"],
            "owner": ["platform-team", "dev-team", "devops", "temporary"],
            "project": ["fynlo-pos", "website", "internal", "testing"],
            "auto-delete": ["7days", "30days", "never"]
        }
    
    def check_resource_tags(self, resource: Dict, resource_type: str) -> List[str]:
        """Check if resource has required tags"""
        violations = []
        
        tags = set(resource.get("tags", []))
        
        # Check for required tags
        missing_tags = self.required_tags - tags
        if missing_tags:
            violations.append(f"Missing required tags: {', '.join(missing_tags)}")
        
        # Check tag format
        for tag in tags:
            if ":" not in tag and tag not in ["temporary", "testing"]:
                violations.append(f"Invalid tag format: {tag} (should be key:value)")
        
        # Check auto-delete tag for temporary resources
        if "temporary" in tags and not any("auto-delete:" in tag for tag in tags):
            violations.append("Temporary resources must have auto-delete tag")
        
        return violations
    
    def audit_untagged_resources(self) -> Dict[str, List[Dict]]:
        """Find all resources without proper tags"""
        untagged = {
            "droplets": [],
            "volumes": [],
            "snapshots": [],
            "databases": [],
            "apps": []
        }
        
        # Check droplets
        response = self.make_request("droplets")
        for droplet in response.get("droplets", []):
            violations = self.check_resource_tags(droplet, "droplet")
            if violations:
                untagged["droplets"].append({
                    "id": droplet["id"],
                    "name": droplet["name"],
                    "violations": violations,
                    "current_tags": droplet.get("tags", [])
                })
        
        # Check volumes
        response = self.make_request("volumes")
        for volume in response.get("volumes", []):
            violations = self.check_resource_tags(volume, "volume")
            if violations:
                untagged["volumes"].append({
                    "id": volume["id"],
                    "name": volume["name"],
                    "violations": violations,
                    "current_tags": volume.get("tags", [])
                })
        
        # Check snapshots
        response = self.make_request("snapshots")
        for snapshot in response.get("snapshots", []):
            violations = self.check_resource_tags(snapshot, "snapshot")
            if violations:
                untagged["snapshots"].append({
                    "id": snapshot["id"],
                    "name": snapshot["name"],
                    "violations": violations,
                    "current_tags": snapshot.get("tags", [])
                })
        
        return untagged
    
    def check_retention_policies(self) -> List[Dict]:
        """Check resources against retention policies"""
        policy_violations = []
        
        # Snapshot retention (30 days for non-critical)
        response = self.make_request("snapshots")
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for snapshot in response.get("snapshots", []):
            tags = snapshot.get("tags", [])
            if "critical-backup" not in tags:
                created_at = datetime.fromisoformat(snapshot["created_at"].replace("Z", "+00:00"))
                if created_at < cutoff_date:
                    policy_violations.append({
                        "type": "snapshot",
                        "id": snapshot["id"],
                        "name": snapshot["name"],
                        "violation": f"Non-critical snapshot older than 30 days ({(datetime.now() - created_at).days} days)",
                        "action": "delete"
                    })
        
        # Auto-delete tagged resources
        for resource_type in ["droplets", "volumes"]:
            response = self.make_request(resource_type)
            for resource in response.get(resource_type, []):
                tags = resource.get("tags", [])
                for tag in tags:
                    if tag.startswith("auto-delete:"):
                        delete_after = tag.split(":")[1]
                        created_at = datetime.fromisoformat(resource["created_at"].replace("Z", "+00:00"))
                        
                        if delete_after == "7days":
                            expiry = created_at + timedelta(days=7)
                        elif delete_after == "30days":
                            expiry = created_at + timedelta(days=30)
                        else:
                            continue
                        
                        if datetime.now() > expiry:
                            policy_violations.append({
                                "type": resource_type[:-1],  # Remove 's'
                                "id": resource["id"],
                                "name": resource["name"],
                                "violation": f"Auto-delete policy expired ({delete_after})",
                                "action": "delete"
                            })
        
        return policy_violations
    
    def generate_tagging_script(self, untagged: Dict) -> str:
        """Generate script to tag resources"""
        script = [
            "#!/bin/bash",
            "# DigitalOcean Resource Tagging Script",
            f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            'echo "🏷️  Tagging Untagged Resources"',
            'echo "============================="',
            ""
        ]
        
        # Function to add tags
        script.append("# Function to add tags to a resource")
        script.append("add_tags() {")
        script.append('    local resource_type=$1')
        script.append('    local resource_id=$2')
        script.append('    local tags=$3')
        script.append('    echo "  Adding tags to $resource_type $resource_id: $tags"')
        script.append('    doctl compute $resource_type tag $resource_id --tag-names "$tags"')
        script.append("}")
        script.append("")
        
        # Tag each resource type
        for resource_type, resources in untagged.items():
            if resources:
                script.append(f"\n# Tag {resource_type}")
                for resource in resources:
                    # Suggest default tags
                    suggested_tags = []
                    if "environment" not in str(resource["current_tags"]):
                        suggested_tags.append("environment:production")
                    if "owner" not in str(resource["current_tags"]):
                        suggested_tags.append("owner:platform-team")
                    if "project" not in str(resource["current_tags"]):
                        suggested_tags.append("project:fynlo-pos")
                    
                    if suggested_tags:
                        tags_str = ",".join(suggested_tags)
                        script.append(f'add_tags "{resource_type[:-1]}" "{resource["id"]}" "{tags_str}"')
        
        script.append("")
        script.append('echo "✅ Tagging complete!"')
        
        return "\n".join(script)
    
    def send_alert(self, subject: str, body: str):
        """Send email alert (configure SMTP settings)"""
        # This is a placeholder - configure with your SMTP settings
        print(f"\n📧 ALERT: {subject}")
        print(body)
        
        # Example SMTP implementation:
        # msg = MIMEText(body)
        # msg['Subject'] = subject
        # msg['From'] = 'alerts@fynlo.com'
        # msg['To'] = 'devops@fynlo.com'
        # 
        # with smtplib.SMTP('smtp.gmail.com', 587) as server:
        #     server.starttls()
        #     server.login('your-email', 'your-password')
        #     server.send_message(msg)
    
    def weekly_audit(self):
        """Run weekly audit and send report"""
        print(f"\n🔍 Running Weekly Audit - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        # Check untagged resources
        untagged = self.audit_untagged_resources()
        total_untagged = sum(len(resources) for resources in untagged.values())
        
        # Check retention policies
        violations = self.check_retention_policies()
        
        # Generate report
        report = [
            f"# Weekly Resource Audit Report",
            f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## Summary",
            f"- Untagged resources: {total_untagged}",
            f"- Retention policy violations: {len(violations)}",
            ""
        ]
        
        # Detail untagged resources
        if total_untagged > 0:
            report.append("## Untagged Resources")
            for resource_type, resources in untagged.items():
                if resources:
                    report.append(f"\n### {resource_type.title()}")
                    for resource in resources[:5]:  # Show first 5
                        report.append(f"- {resource['name']}: {', '.join(resource['violations'])}")
                    if len(resources) > 5:
                        report.append(f"- ... and {len(resources) - 5} more")
        
        # Detail policy violations
        if violations:
            report.append("\n## Retention Policy Violations")
            for violation in violations[:10]:  # Show first 10
                report.append(f"- {violation['type']} '{violation['name']}': {violation['violation']}")
            if len(violations) > 10:
                report.append(f"- ... and {len(violations) - 10} more")
        
        report_text = "\n".join(report)
        
        # Send alert if issues found
        if total_untagged > 0 or violations:
            self.send_alert(
                f"DigitalOcean Audit Alert: {total_untagged} untagged, {len(violations)} violations",
                report_text
            )
        
        # Save report
        report_file = f"audit-report-{datetime.now().strftime('%Y%m%d')}.md"
        with open(report_file, "w") as f:
            f.write(report_text)
        
        # Generate tagging script if needed
        if total_untagged > 0:
            script = self.generate_tagging_script(untagged)
            script_file = f"tag-resources-{datetime.now().strftime('%Y%m%d')}.sh"
            with open(script_file, "w") as f:
                f.write(script)
            os.chmod(script_file, 0o755)
            print(f"🏷️  Tagging script saved to: {script_file}")
        
        print(f"📄 Audit report saved to: {report_file}")
    
    def make_request(self, endpoint: str) -> Dict:
        """Make API request"""
        try:
            response = requests.get(f"{self.base_url}/{endpoint}", headers=self.headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error: {e}")
            return {}


def setup_monitoring():
    """Set up automated monitoring"""
    api_token = os.environ.get("DIGITALOCEAN_TOKEN")
    if not api_token:
        print("❌ Error: DIGITALOCEAN_TOKEN not set")
        return
    
    monitor = ResourceMonitor(api_token)
    
    # Schedule weekly audits (Mondays at 9 AM)
    schedule.every().monday.at("09:00").do(monitor.weekly_audit)
    
    # Run initial audit
    monitor.weekly_audit()
    
    print("\n✅ Monitoring scheduled. Running weekly audits...")
    print("Press Ctrl+C to stop")
    
    # Keep running
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


if __name__ == "__main__":
    # For testing, just run one audit
    api_token = os.environ.get("DIGITALOCEAN_TOKEN")
    if api_token:
        monitor = ResourceMonitor(api_token)
        monitor.weekly_audit()
    else:
        print("Set DIGITALOCEAN_TOKEN environment variable")
        print("For automated monitoring, run: python digitalocean-monitoring.py --daemon")