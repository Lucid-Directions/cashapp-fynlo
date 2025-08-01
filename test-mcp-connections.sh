#!/bin/bash

echo "Testing MCP Server Connections..."
echo "================================"

# Function to test MCP server
test_mcp_server() {
    local server_name=$1
    local command=$2
    shift 2
    local args=("$@")
    
    echo -n "Testing $server_name... "
    
    # Test if the command exists
    if ! command -v "$command" &> /dev/null; then
        echo "❌ Command not found: $command"
        return 1
    fi
    
    # Try to run the MCP server with a test command
    if [[ "$server_name" == "ref" ]]; then
        # Special handling for HTTP-based server
        if curl -s -o /dev/null -w "%{http_code}" "https://api.ref.tools/mcp?apiKey=ref-e06e8f51d674800dffaf" | grep -q "200\|401\|403"; then
            echo "✅ Connected (HTTP)"
        else
            echo "❌ Failed to connect (HTTP)"
        fi
    else
        # For command-based servers, try to start them briefly
        timeout 5s "$command" "${args[@]}" --help &> /dev/null
        if [ $? -eq 124 ] || [ $? -eq 0 ]; then
            echo "✅ Command exists"
        else
            echo "❌ Failed to execute"
        fi
    fi
}

# Test each server from the config
test_mcp_server "filesystem" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-filesystem" "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo"
test_mcp_server "sequential-thinking" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-sequential-thinking"
test_mcp_server "memory-bank" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-memory"
test_mcp_server "playwright" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-playwright"
test_mcp_server "puppeteer" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-puppeteer"
test_mcp_server "semgrep" "uvx" "mcp-server-semgrep"
test_mcp_server "ref" "http" "https://api.ref.tools/mcp?apiKey=ref-e06e8f51d674800dffaf"
test_mcp_server "digitalocean" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-do"
test_mcp_server "sqlite" "uvx" "mcp-server-sqlite" "--db-path" "/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/test.db"
test_mcp_server "terminal" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-shell"
test_mcp_server "homebrew" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-homebrew"
test_mcp_server "duckduckgo" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-duckduckgo"
test_mcp_server "mermaid" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-mermaid"
test_mcp_server "git" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-git"
test_mcp_server "http-client" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-http"
test_mcp_server "task" "/opt/homebrew/bin/npx" "-y" "@modelcontextprotocol/server-task"

echo ""
echo "Checking system dependencies..."
echo "================================"
echo -n "npx: "
command -v /opt/homebrew/bin/npx &> /dev/null && echo "✅ Installed" || echo "❌ Not found"
echo -n "uvx: "
command -v uvx &> /dev/null && echo "✅ Installed" || echo "❌ Not found"
echo -n "curl: "
command -v curl &> /dev/null && echo "✅ Installed" || echo "❌ Not found"

echo ""
echo "Checking npm packages..."
echo "================================"
npm list -g | grep @modelcontextprotocol || echo "No @modelcontextprotocol packages found globally"