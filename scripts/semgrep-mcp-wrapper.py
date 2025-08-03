#!/usr/bin/env python3
"""
Wrapper for semgrep-mcp to handle version compatibility issues
"""
import sys
import subprocess

# For now, just exit gracefully since semgrep-mcp has a bug
# When it's fixed, we can remove this wrapper
print("Semgrep MCP server is currently incompatible with the latest MCP SDK", file=sys.stderr)
print("Waiting for upstream fix...", file=sys.stderr)
sys.exit(1)