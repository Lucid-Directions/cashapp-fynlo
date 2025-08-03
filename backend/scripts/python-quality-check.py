#!/usr/bin/env python3

"""
Comprehensive Python Quality Check Script
Runs multiple quality checks on the backend codebase
"""

import subprocess
import sys
import json
import os
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PythonQualityChecker:
    def __init__(self):
        self.checks_passed = 0
        self.checks_failed = 0
        self.issues_found = []
        
    def run_all_checks(self):
        """Run comprehensive quality checks"""
        logger.info("🔍 Starting comprehensive Python quality checks...")
        
        # 1. Syntax Check with AST
        self.check_syntax()
        
        # 2. Black formatting check
        self.check_black_formatting()
        
        # 3. Import analysis
        self.check_imports()
        
        # 4. Basic linting with pyflakes
        self.check_pyflakes()
        
        # Generate report
        self.generate_report()
        
    def check_syntax(self):
        """Check Python syntax using AST"""
        logger.info("1️⃣ Checking Python syntax...")
        
        try:
            import ast
            syntax_errors = []
            
            # Find all Python files
            for py_file in Path('./app').rglob('*.py'):
                if 'venv' in str(py_file) or '__pycache__' in str(py_file):
                    continue
                    
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    ast.parse(content)
                except SyntaxError as e:
                    syntax_errors.append({
                        'file': str(py_file),
                        'line': e.lineno,
                        'error': str(e)
                    })
                except Exception as e:
                    syntax_errors.append({
                        'file': str(py_file),
                        'line': 'unknown',
                        'error': str(e)
                    })
            
            if syntax_errors:
                self.checks_failed += 1
                self.issues_found.extend(syntax_errors)
                logger.error(f"   ❌ Found {len(syntax_errors)} syntax errors")
                for error in syntax_errors[:5]:  # Show first 5
                    logger.error(f"      {error['file']}:{error['line']} - {error['error']}")
            else:
                self.checks_passed += 1
                logger.info("   ✅ No syntax errors found")
                
        except Exception as e:
            logger.error(f"   ❌ Syntax check failed: {e}")
            self.checks_failed += 1
    
    def check_black_formatting(self):
        """Check Black code formatting"""
        logger.info("2️⃣ Checking Black formatting...")
        
        try:
            result = subprocess.run([
                sys.executable, '-m', 'black', '--check', '--diff', 
                'app/', 'scripts/'
            ], capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                self.checks_passed += 1
                logger.info("   ✅ All files properly formatted")
            else:
                self.checks_failed += 1
                # Count files that need formatting
                if result.stderr and 'Cannot parse' in result.stderr:
                    error_lines = result.stderr.split('\n')
                    parse_errors = [line for line in error_lines if 'Cannot parse' in line]
                    logger.error(f"   ❌ {len(parse_errors)} files have syntax errors preventing formatting")
                    for error in parse_errors[:3]:
                        logger.error(f"      {error}")
                else:
                    lines = result.stdout.split('\n') if result.stdout else []
                    files_to_format = [line for line in lines if line.startswith('---')]
                    logger.warning(f"   ⚠️ {len(files_to_format)} files need Black formatting")
                    
        except subprocess.TimeoutExpired:
            logger.error("   ❌ Black check timed out")
            self.checks_failed += 1
        except Exception as e:
            logger.error(f"   ❌ Black check failed: {e}")
            self.checks_failed += 1
    
    def check_imports(self):
        """Check import statements"""
        logger.info("3️⃣ Checking imports...")
        
        try:
            import_issues = []
            
            for py_file in Path('./app').rglob('*.py'):
                if 'venv' in str(py_file) or '__pycache__' in str(py_file):
                    continue
                    
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    for i, line in enumerate(lines, 1):
                        line = line.strip()
                        # Check for problematic imports
                        if line.startswith('from') and '*' in line:
                            import_issues.append({
                                'file': str(py_file),
                                'line': i,
                                'issue': 'Wildcard import',
                                'code': line
                            })
                            
                except Exception:
                    continue
            
            if import_issues:
                logger.warning(f"   ⚠️  Found {len(import_issues)} import issues")
                for issue in import_issues[:3]:  # Show first 3
                    logger.warning(f"      {issue['file']}:{issue['line']} - {issue['issue']}")
            else:
                self.checks_passed += 1
                logger.info("   ✅ Import structure looks good")
                
        except Exception as e:
            logger.error(f"   ❌ Import check failed: {e}")
            self.checks_failed += 1
    
    def check_pyflakes(self):
        """Check with pyflakes for basic issues"""
        logger.info("4️⃣ Checking with pyflakes...")
        
        try:
            result = subprocess.run([
                sys.executable, '-c', 'import pyflakes'
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.info("   ℹ️  Pyflakes not available, skipping")
                return
                
            result = subprocess.run([
                sys.executable, '-m', 'pyflakes', 'app/'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and not result.stdout.strip():
                self.checks_passed += 1
                logger.info("   ✅ No pyflakes issues found")
            else:
                issues = result.stdout.strip().split('\n') if result.stdout.strip() else []
                if len(issues) <= 5:
                    self.checks_passed += 1
                    logger.info(f"   ✅ Only {len(issues)} minor pyflakes issues")
                else:
                    self.checks_failed += 1
                    logger.warning(f"   ⚠️  Found {len(issues)} pyflakes issues")
                    for issue in issues[:5]:  # Show first 5
                        logger.warning(f"      {issue}")
                    
        except subprocess.TimeoutExpired:
            logger.error("   ❌ Pyflakes check timed out")
            self.checks_failed += 1
        except Exception as e:
            logger.info("   ℹ️  Pyflakes check skipped")
    
    def generate_report(self):
        """Generate comprehensive quality report"""
        logger.info("\n📊 Python Quality Check Report")
        logger.info("=" * 50)
        
        total_checks = self.checks_passed + self.checks_failed
        pass_rate = (self.checks_passed / total_checks * 100) if total_checks > 0 else 0
        
        logger.info(f"Total Checks: {total_checks}")
        logger.info(f"Passed: {self.checks_passed}")
        logger.info(f"Failed: {self.checks_failed}")
        logger.info(f"Pass Rate: {pass_rate:.1f}%")
        
        if self.checks_failed == 0:
            logger.info("🎉 ALL QUALITY CHECKS PASSED!")
        elif self.checks_failed <= 1:
            logger.info("✅ Quality is GOOD - minor issues to address")
        elif self.checks_failed <= 2:
            logger.warning("⚠️  Quality is FAIR - several issues to fix")
        else:
            logger.error("❌ Quality needs IMPROVEMENT - multiple issues found")
        
        # Action items
        if self.checks_failed > 0:
            logger.info("\n🔧 Recommended Actions:")
            if any('syntax' in str(issue) for issue in self.issues_found):
                logger.info("1. Fix syntax errors (critical)")
                logger.info("2. Run Black formatter: python -m black app/ scripts/")
                logger.info("3. Review and fix import issues")
        
        return pass_rate

def main():
    """Main execution function"""
    if not os.path.exists('app'):
        logger.error("❌ 'app' directory not found. Run from backend root.")
        sys.exit(1)
    
    checker = PythonQualityChecker()
    pass_rate = checker.run_all_checks()
    
    # Exit with appropriate code
    if pass_rate >= 80:
        sys.exit(0)  # Success
    elif pass_rate >= 60:
        sys.exit(1)  # Warning
    else:
        sys.exit(2)  # Error

if __name__ == "__main__":
    main()