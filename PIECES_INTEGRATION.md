# Pieces Integration with Claude Code

## Current Status

While Pieces doesn't have a direct MCP (Model Context Protocol) server for Claude Code, we can use several approaches to leverage Pieces for context management:

## Integration Options

### 1. Manual Context Export/Import
- Export snippets from Pieces as markdown files
- Store them in `.claude/context/` directory
- Claude Code will automatically pick them up

### 2. Pieces CLI Workflow
The Pieces CLI is installed but requires interactive setup:
```bash
pieces onboarding  # Run this to set up Pieces CLI
```

Once configured, you can use:
- `pieces list` - List all your saved snippets
- `pieces search <query>` - Search through your snippets
- `pieces save` - Save new snippets

### 3. Context Sync Script
Create a script to sync Pieces snippets to Claude-readable format:

```bash
#!/bin/bash
# sync-pieces-context.sh

# Export Pieces snippets to markdown
pieces list --format markdown > .claude/context/pieces-snippets.md

# Add timestamp
echo "Last synced: $(date)" >> .claude/context/pieces-snippets.md
```

### 4. Use Pieces for:
- **Code Snippets**: Save frequently used patterns
- **API Keys/Configs**: Store sensitive info (never commit these)
- **Architecture Decisions**: Document design choices
- **Debug Solutions**: Save error fixes for future reference

## Recommended Workflow

1. **Save to Pieces**: When you find useful code/context
2. **Tag Appropriately**: Use tags like #fynlo #backend #auth
3. **Export Weekly**: Run sync script to update Claude context
4. **Reference in CLAUDE.md**: Add important snippets to permanent docs

## Alternative: Direct File Integration

Since Pieces stores data locally, we can also:
1. Find where Pieces stores its database
2. Create a read-only integration
3. Parse and convert to Claude-friendly format

## Current Limitations

- No real-time sync between Pieces and Claude Code
- Requires manual export/import process
- Pieces CLI needs interactive setup
- No direct MCP server available yet

## Future Possibilities

- Pieces may release an MCP server
- Custom MCP server could be built using Pieces API
- Automated sync via cron job or git hooks

For now, the best approach is to:
1. Use Pieces for snippet management
2. Periodically export to `.claude/context/`
3. Reference important items in CLAUDE.md