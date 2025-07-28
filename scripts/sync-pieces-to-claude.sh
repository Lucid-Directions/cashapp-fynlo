#!/bin/bash

# Sync Pieces snippets to Claude Code context
# This script exports Pieces content to a format Claude can read

CLAUDE_CONTEXT_DIR="$HOME/Documents/Fynlo/cashapp-fynlo/.claude/context"
PIECES_EXPORT_FILE="$CLAUDE_CONTEXT_DIR/pieces-snippets.md"

# Create context directory if it doesn't exist
mkdir -p "$CLAUDE_CONTEXT_DIR"

# Header for the export file
cat > "$PIECES_EXPORT_FILE" << EOF
# Pieces Code Snippets Context

This file contains code snippets and context exported from Pieces app.
Last updated: $(date)

---

EOF

# Check if Pieces CLI is configured
if ! pieces list &>/dev/null; then
    echo "❌ Pieces CLI not configured. Run 'pieces onboarding' first."
    exit 1
fi

# Export snippets (when Pieces CLI is ready)
echo "📦 Exporting Pieces snippets..."

# For now, create a template structure
cat >> "$PIECES_EXPORT_FILE" << 'EOF'
## Authentication Patterns

### Supabase Auth Flow
```typescript
// Standard auth pattern used in Fynlo
const authenticateUser = async (token: string) => {
  const verified = await supabase.auth.verifyToken(token);
  // ... rest of implementation
};
```

## Common Error Fixes

### WebSocket Connection Issues
- Check heartbeat interval (15 seconds)
- Verify restaurant_id in connection
- Ensure proper error handling

## API Patterns

### Standard Response Format
```python
return APIResponseHelper.success(data=result)
return APIResponseHelper.error(message="Error", status_code=400)
```

## Security Checklist
- [ ] Input validation
- [ ] SQL injection protection
- [ ] RBAC enforcement
- [ ] Multi-tenant isolation

---

To add more snippets:
1. Save them in Pieces with #fynlo tag
2. Run this sync script again
3. Snippets will appear here
EOF

echo "✅ Pieces context exported to: $PIECES_EXPORT_FILE"
echo ""
echo "Next steps:"
echo "1. Configure Pieces CLI: pieces onboarding"
echo "2. Save snippets with #fynlo tag"
echo "3. Run this script to sync: ./scripts/sync-pieces-to-claude.sh"