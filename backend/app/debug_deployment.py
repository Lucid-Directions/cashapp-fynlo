#!/usr/bin/env python3
"""
Diagnostic script to debug deployment structure issues
"""
import os
import sys
import glob

print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")

# Check if models/order.py exists
if os.path.exists("app/models/order.py"):
    with open("app/models/order.py", "r") as f:
        lines = f.readlines()
        print(f"  Total lines: {len(lines)}")
        if len(lines) >= 223:
            print(f"  Line 222: {lines[221].rstrip()}")
            print(f"  Line 223: {lines[222].rstrip()}")
else:
    print("  app/models/order.py not found")

# Check database.py
if os.path.exists("app/core/database.py"):
    with open("app/core/database.py", "r") as f:
        content = f.read()
        if "class Order" in content:
            print("  Found Order class in database.py")
        else:
            print("  Order class not found in database.py")
else:
    print("  app/core/database.py not found")

# List all Python files in models directory
if os.path.exists("app/models"):
    for f in sorted(glob.glob("app/models/*.py")):
        print(f"  - {os.path.basename(f)}")
else:
    print("  app/models directory not found")

# Check for any order-related files
order_files = []
for root, dirs, files in os.walk("app"):
    for file in files:
        if "order" in file.lower() and file.endswith(".py"):
            order_files.append(os.path.join(root, file))

for f in sorted(order_files):
    print(f"  Found order-related file: {f}")

print("\nDebugging complete.")
