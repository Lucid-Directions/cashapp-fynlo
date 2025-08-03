#!/bin/bash
# Wrapper script for semgrep-mcp that handles the compatibility issues

# For now, just provide a helpful error message
echo "{"
echo '  "jsonrpc": "2.0",'
echo '  "id": 1,'
echo '  "error": {'
echo '    "code": -32603,'
echo '    "message": "semgrep-mcp has compatibility issues with current MCP SDK",'
echo '    "data": "The semgrep-mcp package needs to be updated to work with the latest FastMCP API. Visit https://github.com/semgrep/semgrep for updates."'
echo '  }'
echo "}"

# Exit gracefully
exit 0