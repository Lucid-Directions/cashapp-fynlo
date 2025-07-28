#!/bin/bash
# Export Pieces context for Claude Code
# This script exports your recent Pieces activity to Claude-readable format

echo "🔄 Exporting Pieces context for Claude Code..."

# Create context directory
CONTEXT_DIR="$HOME/Documents/Fynlo/cashapp-fynlo/.claude/context"
mkdir -p "$CONTEXT_DIR"

# Output file - single source of truth
OUTPUT_FILE="$CONTEXT_DIR/pieces-context.md"

# Update the context file (preserve saved patterns)
TEMP_FILE="$OUTPUT_FILE.tmp"

# Extract saved code patterns section if it exists
if [ -f "$OUTPUT_FILE" ]; then
    awk '/^## 💡 Saved Code Patterns/,/^## 🚀 Quick Commands/' "$OUTPUT_FILE" > "$CONTEXT_DIR/saved-patterns.tmp" 2>/dev/null || true
fi

# Start the new context file
cat > "$TEMP_FILE" << EOF
# Pieces Context for Claude Code

Last synced: $(date)

## 🔄 Current Development Context

### Active Work
- Working Directory: $(pwd)
- Current Branch: $(git branch --show-current 2>/dev/null || echo 'Not in git repo')
- Active Python Env: ${VIRTUAL_ENV:-None}
- Node Version: $(node --version 2>/dev/null || echo 'Not found')
- NPM Version: $(npm --version 2>/dev/null || echo 'Not found')

### Recent Terminal Activity
EOF

# Try to get recent activity from Pieces (if CLI is configured)
if command -v pieces &> /dev/null; then
    echo "" >> "$TEMP_FILE"
    echo "#### Pieces CLI Status" >> "$TEMP_FILE"
    if pieces list &> /dev/null 2>&1; then
        echo "✅ Pieces CLI configured and ready" >> "$TEMP_FILE"
        # TODO: Add pieces export commands when available
    else
        echo "❌ Pieces CLI not configured. Run 'pieces onboarding' to set it up." >> "$TEMP_FILE"
    fi
fi

# Add recent git activity
echo "" >> "$TEMP_FILE"
echo "### Recent Git Activity" >> "$TEMP_FILE"
echo '```bash' >> "$TEMP_FILE"
git log --oneline -10 >> "$TEMP_FILE" 2>/dev/null
echo '```' >> "$TEMP_FILE"

# Add uncommitted changes
echo "" >> "$TEMP_FILE"
echo "### Uncommitted Changes" >> "$TEMP_FILE"
echo '```bash' >> "$TEMP_FILE"
git status --short >> "$TEMP_FILE" 2>/dev/null || echo "No git repo" >> "$TEMP_FILE"
echo '```' >> "$TEMP_FILE"

# Insert saved code patterns if they exist
if [ -f "$CONTEXT_DIR/saved-patterns.tmp" ]; then
    echo "" >> "$TEMP_FILE"
    cat "$CONTEXT_DIR/saved-patterns.tmp" >> "$TEMP_FILE"
    rm "$CONTEXT_DIR/saved-patterns.tmp"
else
    # Add placeholder for saved patterns
    cat >> "$TEMP_FILE" << 'EOF'

## 💡 Saved Code Patterns & Solutions

### WebSocket Fixes
```python
# Add WebSocket fixes here from Pieces
```

### Authentication Patterns
```typescript
// Add auth patterns here from Pieces
```

### API Response Patterns
```python
# Standard API response pattern
from app.core.response_helper import APIResponseHelper
return APIResponseHelper.success(data=result)
```

EOF
fi

# Add quick commands section
cat >> "$TEMP_FILE" << 'EOF'

## 🚀 Quick Commands

### iOS Bundle Fix
```bash
cd CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Backend Development
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests
```bash
# Backend tests
cd backend && pytest -v

# Frontend tests
npm test
```

## 🔧 Pieces CLI Integration

### Setup (One-time)
```bash
pieces onboarding  # Complete the setup wizard
```

### Usage
```bash
pieces create      # Save current clipboard to Pieces
pieces search "websocket"  # Search saved snippets
pieces list        # List all saved snippets
pieces run         # Interactive mode
```

### Export Context for Claude
```bash
# Run before clearing Claude conversation
./scripts/export-pieces-context.sh
```

## 📝 Architecture Reminders

- **Multi-tenant**: Platform → Restaurants → Users
- **Real-time**: WebSockets for order updates
- **Payments**: QR (1.2%), Card/ApplePay (2.9%), Cash (0%)
- **Auth**: Supabase tokens → Backend verification → PostgreSQL user records

## 🐛 Recent Issues & Solutions

EOF

# Add recent error patterns if logs exist
if [ -d "backend/logs" ]; then
    echo "" >> "$TEMP_FILE"
    echo "### Recent Backend Errors (last 24h)" >> "$TEMP_FILE"
    echo '```' >> "$TEMP_FILE"
    find backend/logs -name "*.log" -mtime -1 -exec grep -i "error\|exception" {} \; | tail -10 >> "$TEMP_FILE" 2>/dev/null || echo "No recent errors found" >> "$TEMP_FILE"
    echo '```' >> "$TEMP_FILE"
fi

# Add footer
echo "" >> "$TEMP_FILE"
echo "---" >> "$TEMP_FILE"
echo "*This file is automatically read by Claude Code when starting new sessions*" >> "$TEMP_FILE"
echo "*Update with: \`./scripts/export-pieces-context.sh\`*" >> "$TEMP_FILE"

# Replace the original file
mv "$TEMP_FILE" "$OUTPUT_FILE"

echo ""
echo "✅ Context exported to: $OUTPUT_FILE"
echo ""
echo "This is your single source of truth for Pieces context!"
echo "Claude Code will automatically read this file in new sessions."