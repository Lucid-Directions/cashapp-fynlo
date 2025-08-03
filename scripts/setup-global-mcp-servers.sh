#!/bin/bash

echo "=== Setting up Global MCP Servers ==="
echo ""
echo "This script will configure MCP servers globally so they're available in all projects"
echo ""

# Remove any existing global MCP servers to start fresh
echo "1. Cleaning up existing global MCP servers..."
for server in filesystem sequential-thinking memory-bank playwright puppeteer semgrep sqlite; do
    claude mcp remove -s user "$server" 2>/dev/null || true
done
echo ""

# Add working MCP servers to global config
echo "2. Adding MCP servers to global configuration..."

# Filesystem - without path for global use
echo "   - Adding filesystem server..."
claude mcp add -s user filesystem "npx -y @modelcontextprotocol/server-filesystem"

# Sequential thinking
echo "   - Adding sequential-thinking server..."
claude mcp add -s user sequential-thinking "npx -y @modelcontextprotocol/server-sequential-thinking"

# Memory bank - use home directory for global database
echo "   - Adding memory-bank server..."
claude mcp add -s user memory-bank "npx -y @modelcontextprotocol/server-memory --db-path $HOME/.claude-mcp-memory.db"

# Playwright
echo "   - Adding playwright server..."
claude mcp add -s user playwright "npx -y mcp-playwright"

# Puppeteer
echo "   - Adding puppeteer server..."
claude mcp add -s user puppeteer "npx -y @modelcontextprotocol/server-puppeteer"

# DigitalOcean
echo "   - Adding digitalocean server..."
claude mcp add -s user digitalocean "npx -y @digitalocean/mcp"

echo ""
echo "3. Waiting for servers to initialize..."
sleep 5

echo ""
echo "4. Checking server status..."
claude mcp list

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Notes:"
echo "- Filesystem server will operate on current directory when used"
echo "- Memory bank database is stored at: ~/.claude-mcp-memory.db"
echo "- Ref server (HTTP) should already be configured"
echo "- Removed broken servers: semgrep, sqlite"
echo ""
echo "If servers show as 'Failed to connect', try:"
echo "1. Restart Claude CLI: pkill -f claude"
echo "2. Clear npm cache: npm cache clean --force"
echo "3. Re-run this script"
echo ""