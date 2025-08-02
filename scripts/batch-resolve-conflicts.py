#!/usr/bin/env python3
"""
Batch conflict resolution for PR #459
Systematically resolves conflicts while preserving Ryan's cleanup work
"""

import subprocess
import re
import os
from pathlib import Path
from typing import List, Tuple
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class ConflictResolver:
    def __init__(self):
        self.resolved_count = 0
        self.failed_files = []
        
    def get_conflicted_files(self) -> List[str]:
        """Get list of files with merge conflicts"""
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--diff-filter=U'],
            capture_output=True, text=True
        )
        return [f.strip() for f in result.stdout.split('\n') if f.strip()]
    
    def analyze_conflict(self, filepath: str) -> dict:
        """Analyze the type of conflict in a file"""
        with open(filepath, 'r') as f:
            content = f.read()
        
        conflict_info = {
            'filepath': filepath,
            'has_httpexception': 'HTTPException' in content,
            'has_print': 'print(' in content,
            'has_logger': 'logger.' in content,
            'conflict_count': content.count('<<<<<<<'),
            'file_type': self.categorize_file(filepath)
        }
        
        return conflict_info
    
    def categorize_file(self, filepath: str) -> str:
        """Categorize file for resolution strategy"""
        if '/endpoints/' in filepath:
            return 'endpoint'
        elif '/core/' in filepath:
            return 'core'
        elif '/services/' in filepath:
            return 'service'
        elif '/middleware/' in filepath:
            return 'middleware'
        elif '/models/' in filepath:
            return 'model'
        else:
            return 'other'
    
    def resolve_simple_import_conflict(self, content: str) -> str:
        """Resolve simple import conflicts"""
        # Pattern for import conflicts
        import_conflict_pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/main'
        
        def resolve_imports(match):
            head_imports = match.group(1)
            main_imports = match.group(2)
            
            # For imports, generally prefer Ryan's cleanup (HEAD) but check for new imports
            # This is a simplified strategy - in reality we'd parse and merge
            if 'HTTPException' in main_imports and 'FynloException' in head_imports:
                return head_imports  # Use Ryan's version
            elif 'logger' in main_imports and 'logger' not in head_imports:
                return main_imports  # Keep logger from main
            else:
                # Default to HEAD (Ryan's cleanup)
                return head_imports
        
        return re.sub(import_conflict_pattern, resolve_imports, content, flags=re.DOTALL)
    
    def resolve_logger_conflicts(self, content: str) -> str:
        """Resolve conflicts where main added logger statements"""
        # Pattern for logger conflicts
        logger_conflict_pattern = r'<<<<<<< HEAD\n=======\n(.*?logger\.(info|error|debug|warning).*?)\n>>>>>>> origin/main'
        
        # Keep logger statements from main
        content = re.sub(logger_conflict_pattern, r'\1', content, flags=re.DOTALL)
        
        return content
    
    def auto_resolve_file(self, filepath: str) -> bool:
        """Attempt to automatically resolve conflicts in a file"""
        try:
            logger.info(f"Resolving: {filepath}")
            
            # Read file
            with open(filepath, 'r') as f:
                content = f.read()
            
            original_content = content
            info = self.analyze_conflict(filepath)
            
            # Apply resolution strategies based on file type
            if info['file_type'] == 'core':
                # For core files, be more careful
                if filepath.endswith('config.py'):
                    # Special handling for config.py - keep logger statements
                    content = self.resolve_logger_conflicts(content)
                elif filepath.endswith('exceptions.py'):
                    # For exceptions, use Ryan's version but check for new exceptions
                    content = self.resolve_simple_import_conflict(content)
            
            elif info['file_type'] == 'endpoint':
                # For endpoints, merge carefully
                content = self.resolve_simple_import_conflict(content)
                content = self.resolve_logger_conflicts(content)
                
                # Ensure FynloException is used
                content = content.replace('raise HTTPException(', 'raise FynloException(')
            
            # Remove any remaining simple conflicts
            if content.count('<<<<<<<') <= 3:  # Only for simple conflicts
                # Try to auto-resolve by taking HEAD version for most cases
                simple_pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> origin/main'
                content = re.sub(simple_pattern, r'\1', content, flags=re.DOTALL)
            
            # Validate no conflict markers remain
            if '<<<<<<<' in content or '=======' in content or '>>>>>>>' in content:
                logger.warning(f"  ⚠️  Complex conflicts remain in {filepath}")
                self.failed_files.append(filepath)
                return False
            
            # Write resolved content
            if content != original_content:
                with open(filepath, 'w') as f:
                    f.write(content)
                
                # Validate Python syntax
                if filepath.endswith('.py'):
                    result = subprocess.run(
                        ['python3', '-m', 'py_compile', filepath],
                        capture_output=True
                    )
                    if result.returncode == 0:
                        logger.info(f"  ✅ Resolved and valid: {filepath}")
                        self.resolved_count += 1
                        return True
                    else:
                        logger.error(f"  ❌ Syntax error after resolution: {filepath}")
                        self.failed_files.append(filepath)
                        return False
                else:
                    self.resolved_count += 1
                    return True
            
            return True
            
        except Exception as e:
            logger.error(f"  ❌ Error resolving {filepath}: {e}")
            self.failed_files.append(filepath)
            return False
    
    def resolve_all(self):
        """Resolve all conflicts"""
        conflicted_files = self.get_conflicted_files()
        total = len(conflicted_files)
        
        logger.info(f"\n🔧 Found {total} files with conflicts")
        logger.info("=" * 50)
        
        # Sort files by priority (core first, then endpoints, then others)
        def priority(f):
            if '/core/' in f:
                return 0
            elif '/endpoints/' in f:
                return 1
            elif '/services/' in f:
                return 2
            else:
                return 3
        
        conflicted_files.sort(key=priority)
        
        # Process each file
        for i, filepath in enumerate(conflicted_files, 1):
            logger.info(f"\n[{i}/{total}] Processing {filepath}")
            info = self.analyze_conflict(filepath)
            logger.info(f"  Type: {info['file_type']}, Conflicts: {info['conflict_count']}")
            
            if info['conflict_count'] > 5:
                logger.warning(f"  ⚠️  Too complex for auto-resolution ({info['conflict_count']} conflicts)")
                self.failed_files.append(filepath)
            else:
                self.auto_resolve_file(filepath)
        
        # Summary
        logger.info("\n" + "=" * 50)
        logger.info("📊 RESOLUTION SUMMARY")
        logger.info("=" * 50)
        logger.info(f"Total files: {total}")
        logger.info(f"Auto-resolved: {self.resolved_count}")
        logger.info(f"Need manual resolution: {len(self.failed_files)}")
        
        if self.failed_files:
            logger.info("\n❌ Files requiring manual resolution:")
            for f in self.failed_files[:10]:  # Show first 10
                logger.info(f"  - {f}")
            
            # Save list for manual processing
            with open('manual_resolution_needed.txt', 'w') as f:
                f.write('\n'.join(self.failed_files))
            logger.info(f"\nFull list saved to: manual_resolution_needed.txt")
        
        # Next steps
        logger.info("\n📝 Next Steps:")
        logger.info("1. Review auto-resolved files: git diff --cached")
        logger.info("2. Manually resolve remaining conflicts")
        logger.info("3. Run: python3 scripts/pr459_fixer.py")
        logger.info("4. Run tests: pytest backend/")

def main():
    resolver = ConflictResolver()
    resolver.resolve_all()

if __name__ == '__main__':
    main()