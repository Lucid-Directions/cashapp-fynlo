#!/bin/bash

echo "=== MCP Server Diagnostic Report ==="
echo "Date: $(date)"
echo ""

# Check Claude CLI version
echo "1. Claude CLI version:"
claude --version || echo "Claude CLI not found"
echo ""

# Check npm and npx versions
echo "2. npm/npx versions:"
npm --version
npx --version
echo ""

# Check if uvx is installed
echo "3. uvx availability (for semgrep):"
which uvx || echo "uvx not found - needed for semgrep-mcp"
echo ""

# Check SQLite database existence
echo "4. SQLite database check:"
DB_PATH="/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend/fynlo.db"
if [ -f "$DB_PATH" ]; then
    echo "✓ Database exists at $DB_PATH"
    ls -lh "$DB_PATH"
else
    echo "✗ Database NOT found at $DB_PATH"
fi
echo ""

# Test each MCP server individually
echo "5. Testing MCP servers individually:"
echo ""

# Desktop Commander (with correct package name)
echo "Desktop Commander (@wonderwhy-er/desktop-commander):"
timeout 5 npx -y @wonderwhy-er/desktop-commander 2>&1 | head -5 || echo "Failed to start"
echo ""

# Ref server
echo "Ref server:"
timeout 5 npx -y @modelcontextprotocol/server-ref 2>&1 | head -5 || echo "Failed to start"
echo ""

# Semgrep (needs uvx)
echo "Semgrep server:"
if command -v uvx &> /dev/null; then
    timeout 5 uvx semgrep-mcp 2>&1 | head -5 || echo "Failed to start"
else
    echo "uvx not installed - install with: brew install uv"
fi
echo ""

# Check npm cache
echo "6. NPM cache status:"
npm cache verify
echo ""

# Check for stale processes
echo "7. Checking for stale MCP processes:"
ps aux | grep -E "(mcp|modelcontextprotocol)" | grep -v grep || echo "No MCP processes found"
echo ""

# Check Claude MCP status
echo "8. Current MCP server status:"
claude mcp list
echo ""

# Check for permission issues
echo "9. Checking file permissions:"
ls -la ~/.mcp.json 2>/dev/null || echo "No global .mcp.json"
ls -la .mcp.json
echo ""

# Network connectivity test (for servers that need internet)
echo "10. Network connectivity:"
curl -s -o /dev/null -w "HTTP status: %{http_code}\n" https://registry.npmjs.org || echo "Network issue"
echo ""

echo "=== Diagnostic complete ==="