#!/usr/bin/env python3
"""Find all Python files with syntax errors"""
import os
import ast
import sys

errors = []
for root, dirs, files in os.walk('app'):
    # Skip __pycache__ directories
    dirs[:] = [d for d in dirs if d != '__pycache__']
    
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r') as f:
                    content = f.read()
                ast.parse(content)
            except SyntaxError as e:
                errors.append(f'{filepath}:{e.lineno}: {e.msg}')

print(f'Found {len(errors)} files with syntax errors:')
for error in sorted(errors):
    print(error)
