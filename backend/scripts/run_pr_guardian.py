#\!/usr/bin/env python3
"""
PR Guardian - Pre-merge code quality scanner
Scans for common issues before merging to main
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple
import json
from datetime import datetime

class PRGuardian:
    def __init__(self, root_path: str = "."):
        self.root_path = Path(root_path)
        self.issues = []
        self.warnings = []
        self.stats = {
            "files_scanned": 0,
            "total_issues": 0,
            "critical_issues": 0,
            "warnings": 0
        }
        
    def scan_all(self):
        """Run all scans"""
        print("🔍 Starting PR Guardian scan...")
        
        # Scan Python files
        for py_file in self.root_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ["venv", "__pycache__", ".git", "migrations"]):
                continue
            self.scan_python_file(py_file)
            
        # Generate report
        self.generate_report()
        
    def scan_python_file(self, filepath: Path):
        """Scan a Python file for issues"""
        self.stats["files_scanned"] += 1
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
        except Exception as e:
            self.add_issue("critical", f"Could not read file: {filepath}", str(e))
            return
            
        # Check for HTTPException (should be FynloException)
        if "HTTPException" in content:
            for i, line in enumerate(lines, 1):
                if "HTTPException" in line and not line.strip().startswith("#"):
                    self.add_issue("critical", f"{filepath}:{i}", "HTTPException found - should be FynloException")
                    
        # Check for missing status_code in FynloException
        if "FynloException" in content:
            for i, line in enumerate(lines, 1):
                if "FynloException(" in line and "status_code=" in line:
                    self.add_issue("warning", f"{filepath}:{i}", "FynloException should not have status_code parameter")
                    
        # Check for malformed docstrings
        in_docstring = False
        docstring_start = 0
        for i, line in enumerate(lines, 1):
            if '"""' in line:
                if not in_docstring:
                    in_docstring = True
                    docstring_start = i
                else:
                    in_docstring = False
                    
        # Check for print statements (should use logger)
        for i, line in enumerate(lines, 1):
            if re.match(r'^\s*print\s*\(', line):
                self.add_issue("warning", f"{filepath}:{i}", "print() found - use logger instead")
                
        # Check for TODO/FIXME comments
        for i, line in enumerate(lines, 1):
            if "TODO" in line or "FIXME" in line:
                self.add_issue("warning", f"{filepath}:{i}", f"Unresolved comment: {line.strip()}")
                
        # Check for hardcoded secrets
        secret_patterns = [
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'password\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']'
        ]
        for pattern in secret_patterns:
            for i, line in enumerate(lines, 1):
                if re.search(pattern, line, re.IGNORECASE):
                    # Skip if it's using environment variables
                    if "os.environ" not in line and "settings." not in line:
                        self.add_issue("critical", f"{filepath}:{i}", "Potential hardcoded secret found")
                        
    def add_issue(self, severity: str, location: str, message: str):
        """Add an issue to the report"""
        issue = {
            "severity": severity,
            "location": location,
            "message": message
        }
        
        if severity == "critical":
            self.issues.append(issue)
            self.stats["critical_issues"] += 1
        else:
            self.warnings.append(issue)
            self.stats["warnings"] += 1
            
        self.stats["total_issues"] += 1
        
    def generate_report(self):
        """Generate and display the report"""
        print("\n" + "="*80)
        print("PR GUARDIAN REPORT")
        print("="*80)
        print(f"\nFiles scanned: {self.stats['files_scanned']}")
        print(f"Total issues found: {self.stats['total_issues']}")
        print(f"Critical issues: {self.stats['critical_issues']}")
        print(f"Warnings: {self.stats['warnings']}")
        
        if self.issues:
            print("\n❌ CRITICAL ISSUES (must fix before merge):")
            print("-"*80)
            for issue in self.issues:
                print(f"  • {issue['location']}: {issue['message']}")
                
        if self.warnings:
            print("\n⚠️  WARNINGS (should fix):")
            print("-"*80)
            for warning in self.warnings:
                print(f"  • {warning['location']}: {warning['message']}")
                
        # Write JSON report
        report = {
            "timestamp": datetime.now().isoformat(),
            "stats": self.stats,
            "critical_issues": self.issues,
            "warnings": self.warnings
        }
        
        with open("pr_guardian_report.json", "w") as f:
            json.dump(report, f, indent=2)
            
        print(f"\n📄 Detailed report saved to: pr_guardian_report.json")
        
        # Exit with error if critical issues found
        if self.stats["critical_issues"] > 0:
            print("\n❌ PR Guardian check FAILED - Critical issues must be fixed\!")
            sys.exit(1)
        else:
            print("\n✅ PR Guardian check PASSED - No critical issues found\!")
            sys.exit(0)

if __name__ == "__main__":
    guardian = PRGuardian()
    guardian.scan_all()
EOF < /dev/null