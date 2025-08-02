#!/usr/bin/env python3
"""
DigitalOcean Cost Optimization Audit Script
Identifies zombie resources and calculates potential savings
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
import requests

class DigitalOceanAuditor:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.digitalocean.com/v2"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        self.zombie_resources = {
            "snapshots": [],
            "volumes": [],
            "reserved_ips": [],
            "inactive_droplets": [],
            "old_backups": [],
            "total_monthly_cost": 0
        }
    
    def make_request(self, endpoint: str) -> Dict:
        """Make API request with error handling"""
        try:
            response = requests.get(f"{self.base_url}/{endpoint}", headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"⚠️  API Error for {endpoint}: {e}")
            return {}
        except Exception as e:
            print(f"❌ Error accessing {endpoint}: {e}")
            return {}
    
    def audit_snapshots(self) -> Tuple[List[Dict], float]:
        """Audit snapshots older than 30 days"""
        print("\n🔍 Auditing Snapshots...")
        old_snapshots = []
        total_cost = 0
        
        data = self.make_request("snapshots")
        if not data or "snapshots" not in data:
            print("  ⚠️  Unable to access snapshots")
            return old_snapshots, total_cost
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
        
        for snapshot in data.get("snapshots", []):
            try:
                created_at = datetime.fromisoformat(snapshot["created_at"].replace("Z", "+00:00"))
            except ValueError:
                continue  # Skip snapshot with invalid date
                
            if created_at < cutoff_date:
                size_gb = snapshot["size_gigabytes"]
                monthly_cost = size_gb * 0.05  # $0.05/GB/month
                
                old_snapshots.append({
                    "id": snapshot["id"],
                    "name": snapshot["name"],
                    "size_gb": size_gb,
                    "created_at": snapshot["created_at"],
                    "age_days": (datetime.now(timezone.utc) - created_at).days,
                    "monthly_cost": monthly_cost,
                    "resource_type": snapshot.get("resource_type", "unknown")
                })
                total_cost += monthly_cost
        
        if old_snapshots:
            print(f"  ⚠️  Found {len(old_snapshots)} snapshots older than 30 days")
            print(f"  💰 Monthly cost: ${total_cost:.2f}")
        else:
            print("  ✅ No old snapshots found")
        
        return old_snapshots, total_cost
    
    def audit_volumes(self) -> Tuple[List[Dict], float]:
        """Audit unattached volumes"""
        print("\n🔍 Auditing Volumes...")
        unattached_volumes = []
        total_cost = 0
        
        data = self.make_request("volumes")
        if not data or "volumes" not in data:
            print("  ⚠️  Unable to access volumes")
            return unattached_volumes, total_cost
        
        for volume in data.get("volumes", []):
            if not volume.get("droplet_ids"):
                size_gb = volume["size_gigabytes"]
                monthly_cost = size_gb * 0.10  # $0.10/GB/month
                
                unattached_volumes.append({
                    "id": volume["id"],
                    "name": volume["name"],
                    "size_gb": size_gb,
                    "created_at": volume["created_at"],
                    "region": volume["region"]["slug"],
                    "monthly_cost": monthly_cost
                })
                total_cost += monthly_cost
        
        if unattached_volumes:
            print(f"  ⚠️  Found {len(unattached_volumes)} unattached volumes")
            print(f"  💰 Monthly cost: ${total_cost:.2f}")
        else:
            print("  ✅ All volumes are attached")
        
        return unattached_volumes, total_cost
    
    def audit_reserved_ips(self) -> Tuple[List[Dict], float]:
        """Audit unassigned reserved IPs"""
        print("\n🔍 Auditing Reserved IPs...")
        unassigned_ips = []
        total_cost = 0
        
        data = self.make_request("reserved_ips")
        if not data or "reserved_ips" not in data:
            print("  ⚠️  Unable to access reserved IPs")
            return unassigned_ips, total_cost
        
        for ip in data.get("reserved_ips", []):
            if not ip.get("droplet"):
                monthly_cost = 5.00  # $5/month per reserved IP
                
                unassigned_ips.append({
                    "ip": ip["ip"],
                    "region": ip["region"]["slug"],
                    "monthly_cost": monthly_cost
                })
                total_cost += monthly_cost
        
        if unassigned_ips:
            print(f"  ⚠️  Found {len(unassigned_ips)} unassigned reserved IPs")
            print(f"  💰 Monthly cost: ${total_cost:.2f}")
        else:
            print("  ✅ All reserved IPs are assigned")
        
        return unassigned_ips, total_cost
    
    def audit_droplets(self) -> Tuple[List[Dict], float]:
        """Audit inactive droplets"""
        print("\n🔍 Auditing Droplets...")
        inactive_droplets = []
        total_cost = 0
        
        data = self.make_request("droplets")
        if not data or "droplets" not in data:
            print("  ⚠️  Unable to access droplets")
            return inactive_droplets, total_cost
        
        for droplet in data.get("droplets", []):
            if droplet["status"] == "off":
                # Estimate monthly cost based on size
                size = droplet["size"]["slug"]
                memory_mb = droplet["memory"]
                vcpus = droplet["vcpus"]
                
                # Rough cost estimation
                if "s-1vcpu-1gb" in size:
                    monthly_cost = 6.00
                elif "s-2vcpu-2gb" in size:
                    monthly_cost = 18.00
                elif "s-4vcpu-8gb" in size:
                    monthly_cost = 48.00
                else:
                    monthly_cost = (memory_mb / 1024) * 10  # Rough estimate
                
                inactive_droplets.append({
                    "id": droplet["id"],
                    "name": droplet["name"],
                    "status": droplet["status"],
                    "size": size,
                    "created_at": droplet["created_at"],
                    "monthly_cost": monthly_cost
                })
                total_cost += monthly_cost
        
        if inactive_droplets:
            print(f"  ⚠️  Found {len(inactive_droplets)} powered-off droplets")
            print(f"  💰 Monthly cost: ${total_cost:.2f}")
        else:
            print("  ✅ All droplets are active")
        
        return inactive_droplets, total_cost
    
    def audit_app_platform(self) -> Dict:
        """Audit App Platform resources"""
        print("\n🔍 Auditing App Platform...")
        optimization_opportunities = []
        
        data = self.make_request("apps")
        if not data or "apps" not in data:
            print("  ⚠️  Unable to access apps")
            return {"opportunities": optimization_opportunities, "potential_savings": 0}
        
        for app in data.get("apps", []):
            app_id = app["id"]
            
            # Check for over-provisioning
            for component in app.get("spec", {}).get("services", []):
                instance_count = component.get("instance_count", 1)
                
                # Check if instances are over-provisioned
                # Note: Without actual usage metrics, we flag any multi-instance service for review
                if instance_count > 1:
                    optimization_opportunities.append({
                        "app": app["spec"]["name"],
                        "component": component["name"],
                        "current_instances": instance_count,
                        "recommendation": "Consider reducing instances based on low usage",
                        "potential_savings": 10 * (instance_count - 1)  # $10/month per extra instance
                    })
        
        if optimization_opportunities:
            print(f"  ⚠️  Found {len(optimization_opportunities)} optimization opportunities")
            total_savings = sum(o["potential_savings"] for o in optimization_opportunities)
            print(f"  💰 Potential monthly savings: ${total_savings:.2f}")
        else:
            print("  ✅ App Platform resources are optimized")
        
        return {
            "opportunities": optimization_opportunities,
            "potential_savings": sum(o.get("potential_savings", 0) for o in optimization_opportunities)
        }
    
    def generate_report(self) -> str:
        """Generate comprehensive audit report"""
        report = [
            "# DigitalOcean Cost Optimization Report",
            f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "\n## Executive Summary\n"
        ]
        
        # Audit each resource type
        snapshots, snapshot_cost = self.audit_snapshots()
        volumes, volume_cost = self.audit_volumes()
        ips, ip_cost = self.audit_reserved_ips()
        droplets, droplet_cost = self.audit_droplets()
        app_audit = self.audit_app_platform()
        
        total_waste = snapshot_cost + volume_cost + ip_cost + droplet_cost + app_audit["potential_savings"]
        
        report.append(f"**Total Potential Monthly Savings: ${total_waste:.2f}**")
        report.append(f"**Annual Savings: ${total_waste * 12:.2f}**\n")
        
        # Detailed findings
        if snapshots:
            report.append("\n## 📸 Old Snapshots")
            report.append(f"Found {len(snapshots)} snapshots older than 30 days (${snapshot_cost:.2f}/month)")
            for snap in snapshots[:5]:  # Show top 5
                report.append(f"- **{snap['name']}**: {snap['size_gb']}GB, {snap['age_days']} days old (${snap['monthly_cost']:.2f}/month)")
            if len(snapshots) > 5:
                report.append(f"- ... and {len(snapshots) - 5} more")
        
        if volumes:
            report.append("\n## 💾 Unattached Volumes")
            report.append(f"Found {len(volumes)} unattached volumes (${volume_cost:.2f}/month)")
            for vol in volumes:
                report.append(f"- **{vol['name']}**: {vol['size_gb']}GB in {vol['region']} (${vol['monthly_cost']:.2f}/month)")
        
        if ips:
            report.append("\n## 🌐 Unassigned Reserved IPs")
            report.append(f"Found {len(ips)} unassigned IPs (${ip_cost:.2f}/month)")
            for ip in ips:
                report.append(f"- **{ip['ip']}**: in {ip['region']} (${ip['monthly_cost']:.2f}/month)")
        
        if droplets:
            report.append("\n## 🖥️ Inactive Droplets")
            report.append(f"Found {len(droplets)} powered-off droplets (${droplet_cost:.2f}/month)")
            for drop in droplets:
                report.append(f"- **{drop['name']}**: {drop['size']} (${drop['monthly_cost']:.2f}/month)")
        
        if app_audit["opportunities"]:
            report.append("\n## 🚀 App Platform Optimization")
            report.append(f"Potential savings: ${app_audit['potential_savings']:.2f}/month")
            for opp in app_audit["opportunities"]:
                report.append(f"- **{opp['app']}** - {opp['component']}: {opp['recommendation']}")
        
        # Recommendations
        report.append("\n## 📋 Recommendations")
        report.append("\n### Immediate Actions:")
        report.append("1. Delete old snapshots (keep only essential backups)")
        report.append("2. Delete or attach unattached volumes")
        report.append("3. Release unassigned reserved IPs")
        report.append("4. Destroy or restart inactive droplets")
        report.append("5. Right-size App Platform instances")
        
        report.append("\n### Long-term Prevention:")
        report.append("1. Implement tagging policy: `environment`, `owner`, `project`, `auto-delete`")
        report.append("2. Set up weekly automated audits")
        report.append("3. Create retention policies for snapshots and backups")
        report.append("4. Configure budget alerts for untagged resources")
        
        # Save zombie resources for cleanup script
        self.zombie_resources = {
            "snapshots": snapshots,
            "volumes": volumes,
            "reserved_ips": ips,
            "inactive_droplets": droplets,
            "total_monthly_cost": total_waste
        }
        
        return "\n".join(report)
    
    def generate_cleanup_script(self) -> str:
        """Generate safe cleanup script"""
        script = [
            "#!/bin/bash",
            "# DigitalOcean Zombie Resource Cleanup Script",
            f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "# ⚠️  REVIEW BEFORE RUNNING - This will DELETE resources!",
            "",
            'echo "🧹 DigitalOcean Resource Cleanup Script"',
            'echo "======================================"',
            "",
            "# Safety check",
            'read -p "Have you reviewed the audit report? (yes/no): " confirm',
            'if [ "$confirm" != "yes" ]; then',
            '    echo "❌ Cleanup cancelled. Please review the audit report first."',
            '    exit 1',
            'fi',
            "",
            f"# Estimated monthly savings: ${self.zombie_resources['total_monthly_cost']:.2f}",
            ""
        ]
        
        # Snapshot cleanup
        if self.zombie_resources["snapshots"]:
            script.append("# Clean up old snapshots")
            script.append('echo "\\n📸 Cleaning up old snapshots..."')
            for snap in self.zombie_resources["snapshots"]:
                script.append(f'echo "  Deleting snapshot: {snap["name"]} ({snap["size_gb"]}GB)"')
                script.append(f'doctl compute snapshot delete {snap["id"]} --force')
        
        # Volume cleanup
        if self.zombie_resources["volumes"]:
            script.append("\n# Clean up unattached volumes")
            script.append('echo "\\n💾 Cleaning up unattached volumes..."')
            for vol in self.zombie_resources["volumes"]:
                script.append(f'echo "  Deleting volume: {vol["name"]} ({vol["size_gb"]}GB)"')
                script.append(f'doctl compute volume delete {vol["id"]} --force')
        
        # Reserved IP cleanup
        if self.zombie_resources["reserved_ips"]:
            script.append("\n# Release unassigned reserved IPs")
            script.append('echo "\\n🌐 Releasing unassigned reserved IPs..."')
            for ip in self.zombie_resources["reserved_ips"]:
                script.append(f'echo "  Releasing IP: {ip["ip"]}"')
                script.append(f'doctl compute reserved-ip delete {ip["ip"]} --force')
        
        # Droplet cleanup (with extra safety)
        if self.zombie_resources["inactive_droplets"]:
            script.append("\n# Handle inactive droplets")
            script.append('echo "\\n🖥️ Handling inactive droplets..."')
            script.append('echo "⚠️  WARNING: This will DESTROY droplets!"')
            script.append('read -p "Proceed with droplet deletion? (yes/no): " droplet_confirm')
            script.append('if [ "$droplet_confirm" == "yes" ]; then')
            for drop in self.zombie_resources["inactive_droplets"]:
                script.append(f'    echo "  Deleting droplet: {drop["name"]}"')
                script.append(f'    doctl compute droplet delete {drop["id"]} --force')
            script.append('else')
            script.append('    echo "  Skipping droplet deletion"')
            script.append('fi')
        
        script.append("")
        script.append('echo "\\n✅ Cleanup complete!"')
        script.append(f'echo "💰 Monthly savings: ${self.zombie_resources["total_monthly_cost"]:.2f}"')
        
        return "\n".join(script)


def main():
    """Main audit function"""
    # Get API token from environment
    api_token = os.environ.get("DIGITALOCEAN_TOKEN")
    if not api_token:
        print("❌ Error: DIGITALOCEAN_TOKEN environment variable not set")
        print("Please set: export DIGITALOCEAN_TOKEN='your-token-here'")
        sys.exit(1)
    
    # Run audit
    print("🔍 Starting DigitalOcean Cost Optimization Audit...")
    auditor = DigitalOceanAuditor(api_token)
    
    # Generate report
    report = auditor.generate_report()
    
    # Save report
    report_file = f"digitalocean-audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    with open(report_file, "w") as f:
        f.write(report)
    print(f"\n📄 Report saved to: {report_file}")
    
    # Generate cleanup script if zombies found
    if auditor.zombie_resources["total_monthly_cost"] > 0:
        cleanup_script = auditor.generate_cleanup_script()
        script_file = f"cleanup-zombies-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sh"
        with open(script_file, "w") as f:
            f.write(cleanup_script)
        os.chmod(script_file, 0o755)
        print(f"🧹 Cleanup script saved to: {script_file}")
        print("⚠️  Review the script carefully before running!")
    
    # Save zombie resources as JSON for programmatic access
    json_file = f"zombie-resources-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(json_file, "w") as f:
        json.dump(auditor.zombie_resources, f, indent=2)
    print(f"📊 Resource data saved to: {json_file}")
    
    print(f"\n✅ Audit complete! Total potential savings: ${auditor.zombie_resources['total_monthly_cost']:.2f}/month")


if __name__ == "__main__":
    main()