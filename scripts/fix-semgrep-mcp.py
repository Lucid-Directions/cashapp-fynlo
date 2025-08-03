#!/usr/bin/env python3
"""
Fix semgrep-mcp by patching the server.py file to remove the version parameter
"""
import os
import sys
import glob

# Find the semgrep-mcp installation
pattern = os.path.expanduser("~/.local/share/uv/tools/semgrep-mcp/lib/python*/site-packages/semgrep_mcp/server.py")
files = glob.glob(pattern)

if not files:
    print("Error: Could not find semgrep-mcp server.py file")
    sys.exit(1)

server_file = files[0]
print(f"Found server.py at: {server_file}")

# Read the file
with open(server_file, 'r') as f:
    content = f.read()

# Check if already patched
if 'version=__version__,' not in content:
    print("File appears to be already patched or has different structure")
    sys.exit(0)

# Patch the file by removing the version parameter
# Try multiple possible formats
originals = [
    """mcp = FastMCP(
    "Semgrep",
    version=__version__,
    request_timeout=DEFAULT_TIMEOUT,
    stateless_http=True,
    json_response=True,
)""",
    """mcp = FastMCP(
    "Semgrep",
    version=__version__,
    request_timeout=DEFAULT_TIMEOUT,
)"""
]

patched_versions = [
    """mcp = FastMCP(
    "Semgrep",
    # version=__version__,  # Commented out - not supported in current FastMCP
    request_timeout=DEFAULT_TIMEOUT,
    stateless_http=True,
    json_response=True,
)""",
    """mcp = FastMCP(
    "Semgrep",
    # version=__version__,  # Commented out - not supported in current FastMCP
    request_timeout=DEFAULT_TIMEOUT,
)"""
]

# Try to find and patch
patched = False
for original, patched_version in zip(originals, patched_versions):
    if original in content:
        content = content.replace(original, patched_version)
        patched = True
        break

if not patched:
    print("Error: Could not find the exact code to patch")
    print("The file structure may have changed")
    sys.exit(1)

# Already patched above, no need to patch again

# Write back
with open(server_file, 'w') as f:
    f.write(content)

print("Successfully patched semgrep-mcp!")
print("The version parameter has been commented out")