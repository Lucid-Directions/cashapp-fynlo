#!/usr/bin/env python3
"""
Comprehensive Python quality checker for PR #459
Runs all 5 Python quality tools and reports results
"""

import subprocess
import sys
import os
from pathlib import Path
from typing import List, Tuple, Dict
import json

class PythonQualityChecker:
    def __init__(self, backend_path: str = "backend"):
        self.backend_path = Path(backend_path)
        self.checks_passed = 0
        self.checks_failed = 0
        self.results = {}
        
    def run_command(self, cmd: List[str], description: str) -> Tuple[bool, str]:
        """Run a command and return success status and output"""
        print(f"\n{'='*60}")
        print(f"🔍 Running: {description}")
        print(f"Command: {' '.join(cmd)}")
        print(f"{'='*60}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.backend_path
            )
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            if success:
                print(f"✅ {description} PASSED")
                self.checks_passed += 1
            else:
                print(f"❌ {description} FAILED")
                print("Output:", output[:500] + "..." if len(output) > 500 else output)
                self.checks_failed += 1
                
            self.results[description] = {
                'success': success,
                'output': output,
                'command': ' '.join(cmd)
            }
            
            return success, output
            
        except Exception as e:
            print(f"❌ Error running {description}: {e}")
            self.checks_failed += 1
            self.results[description] = {
                'success': False,
                'output': str(e),
                'command': ' '.join(cmd)
            }
            return False, str(e)
    
    def run_all_checks(self):
        """Run all 5 Python quality checks"""
        print("🚀 Starting Comprehensive Python Quality Checks")
        print(f"Backend path: {self.backend_path}")
        
        # 1. Python Compilation Check
        self.run_command(
            ["python3", "-m", "compileall", "-q", "app/"],
            "Python Compilation Check"
        )
        
        # 2. Ruff (Fast Python Linter)
        self.run_command(
            ["ruff", "check", "app/", "--statistics"],
            "Ruff Linter Check"
        )
        
        # 3. Black (Code Formatter)
        self.run_command(
            ["black", "--check", "--diff", "app/"],
            "Black Code Format Check"
        )
        
        # 4. MyPy (Type Checker)
        # Create minimal mypy config if not exists
        mypy_config = self.backend_path / "mypy.ini"
        if not mypy_config.exists():
            mypy_config.write_text("""[mypy]
python_version = 3.10
warn_return_any = True
warn_unused_configs = True
ignore_missing_imports = True
""")
        
        self.run_command(
            ["mypy", "app/", "--ignore-missing-imports"],
            "MyPy Type Check"
        )
        
        # 5. Flake8 (Style Guide Enforcement)
        # Create flake8 config if not exists
        flake8_config = self.backend_path / ".flake8"
        if not flake8_config.exists():
            flake8_config.write_text("""[flake8]
max-line-length = 120
exclude = .git,__pycache__,venv,migrations
ignore = E203,W503
""")
        
        self.run_command(
            ["flake8", "app/", "--statistics", "--count"],
            "Flake8 Style Check"
        )
        
        # 6. Bandit (Security Linter)
        self.run_command(
            ["bandit", "-r", "app/", "-f", "json", "-o", "bandit-report.json"],
            "Bandit Security Check"
        )
        
        # Summary
        print(f"\n{'='*60}")
        print("📊 QUALITY CHECK SUMMARY")
        print(f"{'='*60}")
        print(f"✅ Checks Passed: {self.checks_passed}")
        print(f"❌ Checks Failed: {self.checks_failed}")
        print(f"📈 Success Rate: {(self.checks_passed / (self.checks_passed + self.checks_failed) * 100):.1f}%")
        
        # Save detailed results
        results_file = self.backend_path / "python-quality-results.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\n💾 Detailed results saved to: {results_file}")
        
        # Exit code
        return 0 if self.checks_failed == 0 else 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Run Python quality checks')
    parser.add_argument('--backend-path', default='backend', help='Path to backend directory')
    args = parser.parse_args()
    
    checker = PythonQualityChecker(args.backend_path)
    sys.exit(checker.run_all_checks())

if __name__ == '__main__':
    main()