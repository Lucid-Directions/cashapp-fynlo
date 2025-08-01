#!/bin/bash

echo "MCP Server Detailed Diagnostics"
echo "==============================="
echo ""

# Test npx directly
echo "1. Testing npx directly:"
echo "-----------------------"
/opt/homebrew/bin/npx --version
echo ""

# Test a simple MCP server with verbose output
echo "2. Testing filesystem MCP server with verbose output:"
echo "----------------------------------------------------"
/opt/homebrew/bin/npx -y @modelcontextprotocol/server-filesystem --version 2>&1 || echo "Exit code: $?"
echo ""

# Check if MCP packages are cached
echo "3. Checking npx cache for MCP packages:"
echo "---------------------------------------"
ls -la ~/.npm/_npx/ 2>/dev/null | grep modelcontext || echo "No MCP packages in npx cache"
echo ""

# Test uvx
echo "4. Testing uvx:"
echo "---------------"
which uvx
uvx --version 2>&1 || echo "uvx version check failed"
echo ""

# Check node and npm versions
echo "5. System versions:"
echo "------------------"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo ""

# Test specific MCP server with full error output
echo "6. Testing sequential-thinking server with full output:"
echo "------------------------------------------------------"
echo "Command: /opt/homebrew/bin/npx -y @modelcontextprotocol/server-sequential-thinking"
/opt/homebrew/bin/npx -y @modelcontextprotocol/server-sequential-thinking 2>&1 | head -20
echo ""

# Check for desktop-commander
echo "7. Testing desktop-commander (mentioned in CLAUDE.md):"
echo "-----------------------------------------------------"
/opt/homebrew/bin/npx -y @modelcontextprotocol/server-desktop-commander --help 2>&1 | head -10
echo ""

# List all available MCP servers in npm registry
echo "8. Available MCP servers in npm:"
echo "-------------------------------"
npm search @modelcontextprotocol/server --json | jq -r '.[] | .name' 2>/dev/null | head -10 || echo "Failed to search npm"