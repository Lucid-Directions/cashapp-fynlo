# Pieces CLI Workflow for Claude Code Context

## 🎯 The Better Way: Use Pieces CLI Directly!

Instead of manual exports, use Pieces CLI's built-in context features:

### 1. Initial Setup (One-time)
```bash
pieces onboarding
```

### 2. Save Context While Working
```bash
# Save current clipboard content
pieces create

# Save with a specific name
pieces create -n "websocket-auth-fix"

# Save a file directly
pieces create -f backend/app/api/websocket.py
```

### 3. Ask Questions with Context
```bash
# Ask about saved materials
pieces ask "What was the WebSocket fix?" -m 4

# Ask with file context
pieces ask "Explain this auth flow" -f backend/app/api/auth.py

# Ask with multiple contexts
pieces ask "How does this compare to our standard pattern?" -m 2 -f backend/app/api/new_endpoint.py
```

### 4. Search Your History
```bash
# Search saved snippets
pieces search "websocket"

# List all materials
pieces list

# Open specific material
pieces open 4
```

### 5. Chat Management
```bash
# View all conversations
pieces chats

# View current conversation
pieces chat

# Create new conversation
pieces chat --new

# Switch to specific conversation
pieces chat 3
```

## 🚀 For Claude Code Sessions

### When Starting New Session
Instead of running export scripts, just tell Claude:
"Check my recent Pieces context about [topic]"

Then Claude can use:
```bash
# Search for relevant context
pieces search "websocket authentication"

# Get specific saved solutions
pieces list | grep -i "fix"

# Ask Pieces Copilot for summary
pieces ask "What have I been working on recently?"
```

### Save Important Fixes
```bash
# Copy the fix to clipboard, then:
pieces create -n "fix-textinput-import"

# Or save directly from file
pieces create -f src/screens/onboarding/ComprehensiveRestaurantOnboardingScreen.tsx -n "onboarding-screen-complete"
```

## 📝 Benefits Over Manual Export

1. **Real-time**: No need to run export scripts
2. **Searchable**: Full-text and neural search
3. **Contextual**: Can include multiple files/snippets
4. **AI-Enhanced**: Pieces Copilot understands your code
5. **Persistent**: Survives Claude session restarts

## 🔧 MCP Integration (Future)

Pieces CLI supports MCP setup for VS Code, Cursor, and Goose:
```bash
# Set up MCP
pieces mcp setup

# Check MCP status
pieces mcp status

# Repair if needed
pieces mcp repair
```

This would give Claude direct access to Pieces context without manual commands!

---
*Replace manual exports with direct Pieces CLI usage for better workflow*