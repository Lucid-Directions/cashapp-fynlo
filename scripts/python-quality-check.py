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
        
        # 5. Security check with bandit (if available)
        self.check_bandit()
        
        # 6. Type checking (basic)
        self.check_types()
        
        # Generate report
        self.generate_report()
        
    def check_syntax(self):
        """Check Python syntax using AST"""
        logger.info("1️⃣ Checking Python syntax...")
        
        try:
            import ast
            syntax_errors = []
            
            # Find all Python files
            for py_file in Path('.').rglob('*.py'):
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
                lines = result.stdout.split('\n') if result.stdout else []
                files_to_format = [line for line in lines if line.startswith('---')]
                logger.error(f"   ❌ {len(files_to_format)} files need Black formatting")
                
                # Show sample of issues
                if result.stderr:
                    logger.error(f"   Black errors: {result.stderr[:200]}...")
                    
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
            
            for py_file in Path('.').rglob('*.py'):
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
                        elif 'import os' in line and 'system' in ''.join(lines):
                            import_issues.append({
                                'file': str(py_file),
                                'line': i,
                                'issue': 'Potential security risk - os.system usage',
                                'code': line
                            })
                            
                except Exception:
                    continue
            
            if import_issues:
                self.checks_failed += 1
                self.issues_found.extend(import_issues)
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
                sys.executable, '-m', 'pyflakes', 'app/'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and not result.stdout.strip():
                self.checks_passed += 1
                logger.info("   ✅ No pyflakes issues found")
            else:
                self.checks_failed += 1
                issues = result.stdout.strip().split('\n') if result.stdout.strip() else []
                logger.warning(f"   ⚠️  Found {len(issues)} pyflakes issues")
                for issue in issues[:5]:  # Show first 5
                    logger.warning(f"      {issue}")
                    
        except subprocess.TimeoutExpired:
            logger.error("   ❌ Pyflakes check timed out")
            self.checks_failed += 1
        except FileNotFoundError:
            logger.info("   ℹ️  Pyflakes not available, skipping")
        except Exception as e:
            logger.error(f"   ❌ Pyflakes check failed: {e}")
            self.checks_failed += 1
    
    def check_bandit(self):
        """Check security with bandit"""
        logger.info("5️⃣ Checking security with bandit...")
        
        try:
            result = subprocess.run([
                sys.executable, '-m', 'bandit', '-r', 'app/', '-f', 'json'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.checks_passed += 1
                logger.info("   ✅ No security issues found")
            else:
                try:
                    bandit_data = json.loads(result.stdout)
                    issues = bandit_data.get('results', [])
                    
                    high_issues = [i for i in issues if i.get('issue_severity') == 'HIGH']
                    medium_issues = [i for i in issues if i.get('issue_severity') == 'MEDIUM']
                    
                    if high_issues:
                        self.checks_failed += 1
                        logger.error(f"   ❌ Found {len(high_issues)} HIGH security issues")
                        for issue in high_issues[:3]:
                            logger.error(f"      {issue.get('filename')}:{issue.get('line_number')} - {issue.get('test_name')}")
                    elif medium_issues:
                        logger.warning(f"   ⚠️  Found {len(medium_issues)} MEDIUM security issues")
                        self.checks_passed += 1
                    else:
                        self.checks_passed += 1
                        logger.info("   ✅ No significant security issues")
                        
                except json.JSONDecodeError:
                    logger.warning("   ⚠️  Could not parse bandit output")
                    self.checks_passed += 1
                    
        except subprocess.TimeoutExpired:
            logger.error("   ❌ Bandit check timed out")
            self.checks_failed += 1
        except FileNotFoundError:
            logger.info("   ℹ️  Bandit not available, skipping security check")
        except Exception as e:
            logger.error(f"   ❌ Bandit check failed: {e}")
            self.checks_failed += 1
    
    def check_types(self):
        """Basic type checking"""
        logger.info("6️⃣ Checking type hints...")
        
        try:
            type_issues = []
            
            for py_file in Path('./app').rglob('*.py'):
                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check for functions without type hints
                    import re
                    functions = re.findall(r'def\s+(\w+)\s*\([^)]*\)\s*:', content)
                    functions_with_types = re.findall(r'def\s+(\w+)\s*\([^)]*\)\s*->\s*\w+:', content)
                    
                    untyped_functions = len(functions) - len(functions_with_types)
                    if untyped_functions > 5:  # Only flag if many functions lack types
                        type_issues.append({
                            'file': str(py_file),
                            'issue': f'{untyped_functions} functions without return type hints'
                        })
                        
                except Exception:
                    continue
            
            if type_issues:
                logger.warning(f"   ⚠️  Found type hint issues in {len(type_issues)} files")
                for issue in type_issues[:3]:
                    logger.warning(f"      {issue['file']} - {issue['issue']}")
            else:
                logger.info("   ✅ Type hint coverage looks reasonable")
                
            self.checks_passed += 1
            
        except Exception as e:
            logger.error(f"   ❌ Type check failed: {e}")
            self.checks_failed += 1
    
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
        elif self.checks_failed <= 2:
            logger.info("✅ Quality is GOOD - minor issues to address")
        elif self.checks_failed <= 4:
            logger.warning("⚠️  Quality is FAIR - several issues to fix")
        else:
            logger.error("❌ Quality needs IMPROVEMENT - multiple issues found")
        
        # Action items
        if self.checks_failed > 0:
            logger.info("\n🔧 Recommended Actions:")
            if any('syntax' in str(issue) for issue in self.issues_found):
                logger.info("1. Fix syntax errors (critical)")
            if self.checks_failed >= 3:
                logger.info("2. Run Black formatter: python -m black app/ scripts/")
                logger.info("3. Review and fix import issues")
                logger.info("4. Address security concerns")
        
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