#!/bin/bash

# Setup MCP configuration for Cursor with proper tokens
# This script creates the mcp.json file with environment-specific tokens

echo "Setting up MCP configuration for Cursor..."

# Create .cursor directory if it doesn't exist
mkdir -p .cursor

# Get tokens from environment or prompt
if [ -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
    echo "Please enter your DigitalOcean access token:"
    read -s DIGITALOCEAN_ACCESS_TOKEN
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Please enter your Supabase access token (or press Enter to skip):"
    read -s SUPABASE_ACCESS_TOKEN
fi

if [ -z "$GITHUB_TOKEN" ]; then
    # Try to get from gh auth
    GITHUB_TOKEN=$(gh auth token 2>/dev/null)
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "Please enter your GitHub token (or press Enter to skip):"
        read -s GITHUB_TOKEN
    fi
fi

# Get Supabase credentials from .env.production
SUPABASE_URL="https://eweggzpvuqczrrrwszyy.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDc4MjIxNywiZXhwIjoyMDY2MzU4MjE3fQ.3MZGwVJXzzeI4pRgN2amPnBrL6LuAKJLiAPmUBucFZE"

# Create the mcp.json file
cat > .cursor/mcp.json << EOF
{
  "mcpServers": {
    "digitalocean-mcp-local": {
      "command": "npx",
      "args": [
        "-y",
        "@digitalocean/mcp-server"
      ],
      "env": {
        "DIGITALOCEAN_ACCESS_TOKEN": "${DIGITALOCEAN_ACCESS_TOKEN}"
      },
      "enabled": true
    },
    "supabase-mcp-local": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server",
        "--url",
        "${SUPABASE_URL}",
        "--service-role-key",
        "${SUPABASE_SERVICE_KEY}"
      ],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_KEY}",
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      },
      "enabled": true
    },
    "github-mcp-local": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "enabled": true
    },
    "semgrep-mcp-local": {
      "command": "npx",
      "args": [
        "-y",
        "@semgrep/mcp-server"
      ],
      "enabled": true
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo"
      ],
      "enabled": true
    },
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ],
      "enabled": true
    },
    "memory-bank": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory-bank"
      ],
      "enabled": true
    }
  }
}
EOF

echo "✅ MCP configuration created at .cursor/mcp.json"
echo ""
echo "⚠️  IMPORTANT: Keep your tokens secure!"
echo "   - Never commit .cursor/mcp.json to git"
echo "   - Add .cursor/mcp.json to .gitignore"
echo ""
echo "To use in Cursor:"
echo "1. Restart Cursor"
echo "2. The MCP servers should be available automatically"
echo ""
echo "Available MCP servers:"
echo "  - digitalocean-mcp-local: DigitalOcean management"
echo "  - supabase-mcp-local: Supabase database & auth"
echo "  - github-mcp-local: GitHub operations"
echo "  - semgrep-mcp-local: Code security scanning"
echo "  - filesystem: File operations"
echo "  - sequential-thinking: Problem solving"
echo "  - memory-bank: Context persistence"