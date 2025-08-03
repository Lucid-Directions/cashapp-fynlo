#!/bin/bash

echo "=== Fixing MCP Server Configuration ==="
echo ""

# 1. Fix desktop-commander
echo "1. Updating desktop-commander to correct package..."
claude mcp remove desktop-commander -s project 2>/dev/null
claude mcp add desktop-commander npx -y @wonderwhy-er/desktop-commander
echo ""

# 2. Remove non-existent ref server
echo "2. Removing non-existent ref server..."
claude mcp remove ref -s project 2>/dev/null
echo "Note: The ref server package doesn't exist in npm registry"
echo ""

# 3. Fix sqlite - create database if needed
echo "3. Checking SQLite database..."
DB_PATH="/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend/fynlo.db"
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found. Creating empty database..."
    mkdir -p "$(dirname "$DB_PATH")"
    touch "$DB_PATH"
    echo "Created empty database at $DB_PATH"
fi
echo ""

# 4. Fix semgrep - use correct command
echo "4. Fixing semgrep server..."
claude mcp remove semgrep -s project 2>/dev/null
# Check if uv is installed
if command -v uvx &> /dev/null; then
    claude mcp add semgrep uvx semgrep-mcp
else
    echo "uvx not found. Install with: brew install uv"
fi
echo ""

# 5. Remove snyk if not needed
echo "5. Removing untracked snyk server..."
claude mcp remove snyk -s project 2>/dev/null
echo ""

# 6. Clear npm cache to prevent stale packages
echo "6. Clearing npm cache..."
npm cache clean --force
echo ""

# 7. Kill any stale MCP processes
echo "7. Killing stale MCP processes..."
pkill -f "mcp-server" || echo "No stale processes found"
echo ""

# 8. Restart Claude MCP servers
echo "8. Restarting MCP servers..."
claude mcp restart
echo ""

# 9. Show final status
echo "9. Final MCP server status:"
claude mcp list
echo ""

echo "=== Fix complete ==="
echo ""
echo "To prevent future issues:"
echo "1. The diagnostic script is at: scripts/diagnose-mcp-servers.sh"
echo "2. Run it periodically to check server health"
echo "3. Consider adding to your shell profile:"
echo "   alias mcp-check='~/Documents/Fynlo/cashapp-fynlo/scripts/diagnose-mcp-servers.sh'"
echo ""