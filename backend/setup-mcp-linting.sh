#!/bin/bash
# Setup MCP servers for Python syntax checking

echo "🔧 Setting up MCP servers for Python linting..."

# Install Tree-sitter MCP Server
echo "📦 Installing Tree-sitter MCP Server..."
pip install mcp-server-tree-sitter

# Clone and setup MCP Code Checker
echo "📦 Setting up MCP Code Checker..."
if [ ! -d "mcp-code-checker" ]; then
    git clone https://github.com/MarcusJellinghaus/mcp-code-checker.git
    cd mcp-code-checker
    pip install -r requirements.txt
    cd ..
fi

# Optional: Setup Quack MCP Server for advanced checking
echo "📦 Setting up Quack MCP Server (optional)..."
# uv run quack.py

echo "✅ MCP linting servers installed!"
echo ""
echo "To use these servers:"
echo "1. Add the contents of .mcp-python-linting.json to your ~/.mcp.json"
echo "2. Restart Claude Desktop or your MCP client"
echo "3. Use prompts like:"
echo "   - 'Run pylint on backend/app to find all syntax errors'"
echo "   - 'Use tree-sitter to analyze app/core/exceptions.py for parsing errors'"
echo "   - 'Check all Python files in app/api/v1/endpoints/ for syntax issues'"