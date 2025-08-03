#!/usr/bin/env python3
"""
Diagnostic script to debug deployment structure issues
"""
import os
import sys
import glob

print("=== Deployment Debug Info ===")
print(f"Current working directory: {os.getcwd()}")
print(f"Python version: {sys.version}")
print(f"Script location: {os.path.abspath(__file__)}")

# Check if models/order.py exists
if os.path.exists("app/models/order.py"):
    print("\n✅ Found app/models/order.py")
    with open("app/models/order.py", "r") as f:
        lines = f.readlines()
        print(f"  Total lines: {len(lines)}")
        if len(lines) >= 223:
            print(f"  Line 222: {lines[221].rstrip()}")
            print(f"  Line 223: {lines[222].rstrip()}")
else:
    print("\n❌ app/models/order.py does not exist")

# Check database.py
if os.path.exists("app/core/database.py"):
    print("\n✅ Found app/core/database.py")
    with open("app/core/database.py", "r") as f:
        content = f.read()
        if "class Order" in content:
            print("  Contains Order class")
else:
    print("\n❌ app/core/database.py does not exist")

# List all Python files in models directory
print("\n📁 Files in app/models/:")
if os.path.exists("app/models"):
    for f in sorted(glob.glob("app/models/*.py")):
        print(f"  - {os.path.basename(f)}")
else:
    print("  Directory does not exist")

# Check for any order-related files
print("\n🔍 Searching for order-related files:")
order_files = []
for root, dirs, files in os.walk("app"):
    for file in files:
        if "order" in file.lower() and file.endswith(".py"):
            order_files.append(os.path.join(root, file))

for f in sorted(order_files):
    print(f"  - {f}")

print("\n=== End Debug Info ===")
