# MCP Configuration Setup for Cursor

## Overview
This directory contains the MCP (Model Context Protocol) configuration for Cursor IDE to connect to various services like DigitalOcean, Supabase, and GitHub.

## Setup Instructions

### 1. Get Your Tokens

#### DigitalOcean Token
```bash
# If you have doctl configured:
doctl auth list

# Or get from DigitalOcean dashboard:
# https://cloud.digitalocean.com/account/api/tokens
```

#### Supabase Access Token  
```bash
# Login to Supabase CLI:
supabase login

# Or get from:
# https://app.supabase.com/account/tokens
```

#### GitHub Token
```bash
# If you have gh CLI:
gh auth token

# Or create at:
# https://github.com/settings/tokens
```

### 2. Create Your Configuration

Option A: Use the setup script
```bash
cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo
./cursor/setup-mcp-tokens.sh
```

Option B: Copy and edit manually
```bash
cp .cursor/mcp.example.json .cursor/mcp.json
# Edit mcp.json and replace YOUR_*_TOKEN_HERE with actual tokens
```

### 3. Verify Security

**IMPORTANT**: The `.cursor/mcp.json` file is already in `.gitignore` to prevent accidental token exposure.

### 4. Restart Cursor

After creating `mcp.json`, restart Cursor for the changes to take effect.

## Available MCP Servers

### Production Services
- **digitalocean-mcp-local**: Manage DigitalOcean apps, databases, and infrastructure
- **supabase-mcp-local**: Access Supabase database, auth, and storage
- **github-mcp-local**: Interact with GitHub repos, issues, and PRs

### Development Tools
- **filesystem**: File operations within the project
- **sequential-thinking**: Break down complex problems
- **memory-bank**: Persist context across sessions
- **semgrep-mcp-local**: Security scanning

## Supabase Connection Details

- **URL**: `https://eweggzpvuqczrrrwszyy.supabase.co`
- **Anon Key**: (Public - safe to share) `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s`
- **Service Role Key**: (SENSITIVE - keep secure) Already included in example config

## Troubleshooting

### MCP servers not showing in Cursor
1. Ensure `mcp.json` exists (not `mcp.template.json`)
2. Check file permissions: `ls -la .cursor/mcp.json`
3. Restart Cursor completely
4. Check Cursor logs: View → Output → MCP

### Token issues
- DigitalOcean: Run `doctl auth init` to set up token
- Supabase: Run `supabase login` to authenticate
- GitHub: Run `gh auth login` to authenticate

### File not found errors
- Ensure paths in `mcp.json` are absolute, not relative
- Check that npx is installed: `which npx`

## Security Notes

1. **Never commit `mcp.json`** - it contains sensitive tokens
2. The file is in `.gitignore` for safety
3. Use environment variables when possible
4. Rotate tokens regularly
5. Use minimal scopes for tokens

## Need Help?

1. Check the example config: `.cursor/mcp.example.json`
2. Run the setup script: `./cursor/setup-mcp-tokens.sh`
3. Review CLAUDE.md for project-specific MCP usage