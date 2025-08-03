# MCP Server Troubleshooting Guide

## Final Working MCP Configuration (August 2025)

✅ **6 Stable MCP Servers:**
1. **filesystem** - File operations across the project
2. **sequential-thinking** - Breaking down complex problems
3. **memory-bank** - Context persistence between sessions
4. **playwright** - Browser automation and testing
5. **puppeteer** - Alternative browser automation
6. **Ref** - Documentation search & API references (HTTP)

❌ **Removed Servers:**
- **semgrep** - Incompatible with current MCP SDK
- **sqlite** - Connection issues
- **desktop-commander** - Wrong package name
- **PostgreSQL** - Not recommended due to security concerns

## Why MCP Servers Keep Failing

### Root Causes Identified

1. **Incorrect Package Names**
   - `desktop-commander`: Was using `@cloudflare/mcp-server-desktop-commander` (doesn't exist)
   - Should be: `@wonderwhy-er/desktop-commander`

2. **Non-Existent Packages**
   - `ref`: Package `@modelcontextprotocol/server-ref` doesn't exist in npm registry
   - No alternative found yet

3. **Missing Dependencies**
   - `sqlite`: Database file `/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/backend/fynlo.db` doesn't exist
   - `semgrep`: Requires `uvx` (UV package manager) to be installed

4. **Stale NPM Cache**
   - NPM's aggressive caching can serve outdated package information
   - Leads to "package not found" errors even after fixes

5. **Process Persistence**
   - Old MCP server processes continue running after failures
   - Prevents new instances from starting correctly

## Quick Fix Commands

```bash
# Run the fix script
./scripts/fix-mcp-servers.sh

# Or manually fix specific servers:
claude mcp remove desktop-commander -s project
claude mcp add desktop-commander npx -y @wonderwhy-er/desktop-commander

# Add Ref server (HTTP transport, not npm):
claude mcp add --transport http Ref "https://api.ref.tools/mcp?apiKey=ref-e06e8f51d674800dffaf"

# Install missing dependencies
brew install uv  # For semgrep
```

## Diagnostic Tools

### 1. Health Check Script
```bash
./scripts/diagnose-mcp-servers.sh
```

This script checks:
- Claude CLI version
- Package availability
- Database existence
- Network connectivity
- Running processes
- Current server status

### 2. Quick Status Check
```bash
claude mcp list
```

### 3. Individual Server Test
```bash
# Test a specific server
npx -y @wonderwhy-er/desktop-commander
```

## Prevention Strategies

### 1. Regular Maintenance
- Run diagnostic script weekly
- Clear npm cache monthly: `npm cache clean --force`
- Check for package updates

### 2. Proper Configuration
- Always verify package names exist in npm
- Use correct command syntax (npx vs uvx)
- Ensure file paths are absolute and exist

### 3. Environment Setup
```bash
# Add to ~/.zshrc or ~/.bashrc
alias mcp-check='~/Documents/Fynlo/cashapp-fynlo/scripts/diagnose-mcp-servers.sh'
alias mcp-fix='~/Documents/Fynlo/cashapp-fynlo/scripts/fix-mcp-servers.sh'
```

### 4. Process Management
- Kill stale processes before restarting
- Use `claude mcp restart` instead of manual restarts

## Working MCP Servers

As of latest check, these servers work reliably:
- ✅ filesystem - File operations
- ✅ sequential-thinking - Problem solving
- ✅ memory-bank - Context persistence
- ✅ playwright - Browser automation
- ✅ puppeteer - Browser automation
- ✅ Ref - Documentation & search (HTTP transport)

## Problematic Servers

- ✅ ref - Fixed! Uses HTTP transport, not npm package
- ⚠️ sqlite - Connection issues despite correct package
- ⚠️ semgrep - Has upstream compatibility bug with MCP SDK

## Persistent Storage Solution

To prevent losing configuration:
1. Keep `.mcp.json` in version control
2. Document working package versions
3. Create setup script for new environments

## When All Else Fails

1. Remove all MCP servers: `claude mcp remove --all`
2. Clear npm cache: `npm cache clean --force`
3. Kill all MCP processes: `pkill -f mcp`
4. Re-add servers one by one
5. Test each server individually before adding the next

## Future Improvements

1. **Version Pinning**: Pin specific versions in .mcp.json
2. **Health Monitoring**: Automated daily health checks
3. **Fallback Configs**: Keep backup configurations
4. **Documentation**: Keep this guide updated with new findings