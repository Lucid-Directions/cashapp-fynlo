# PR: Add Subagents and Update CLAUDE.md with New Rule

## What
- Added 4 new subagents to `.claude/subagents/`:
  - **ios-bundle-builder.md**: Automates iOS bundle building process with error handling
  - **backend-api-developer.md**: FastAPI development patterns and best practices
  - **security-guard.md**: Multi-tenant security validation and RBAC enforcement
  - **git-workflow-manager.md**: PR automation and Git workflow management
  
- Updated CLAUDE.md with critical new rule:
  - **DO NOT CHANGE ANY CODE - RAISE ALL PROBLEMS AS GITHUB ISSUES**

## Why
- The subagents provide specialized knowledge and workflows for common Fynlo development tasks
- They complement the existing 8 subagents already in `.claude/agents/`
- The new rule in CLAUDE.md ensures all code changes go through proper review process

## Testing
- Subagents are documentation files that enhance Claude Code's capabilities
- No code changes were made that require testing
- The new rule has been added to the Git Workflow section of CLAUDE.md

## MCP Servers Installed
During this session, also installed 8 MCP servers for enhanced development:
1. Desktop Commander - File system access
2. Sequential Thinking - Problem solving
3. File System - Local file operations
4. Memory Bank - Session memory
5. Playwright - Browser automation
6. Puppeteer - Alternative browser automation
7. Semgrep - Code security analysis
8. DigitalOcean MCP - Infrastructure management

All MCP servers are connected and functional.