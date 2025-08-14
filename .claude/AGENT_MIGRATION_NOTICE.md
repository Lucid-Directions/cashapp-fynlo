# Agent System Migration Notice

## What Changed
After the recent Cursor update, the agent system has changed. Previously configured agents are no longer recognized as separate selectable entities.

## Current Status
- **Agent markdown files**: Still present in `.claude/agents/` directory
- **Agent functionality**: Must be invoked manually by referencing the agent files
- **Built-in agents**: No longer appear in `/agents` command

## How to Use Agents Now

### Method 1: Direct Reference
Tell Claude to act as a specific agent:
```
Please act as the pr-guardian agent following the instructions in:
.claude/agents/github/pr-guardian.md
```

### Method 2: Use the Helper Script
```bash
# List available agents
./.claude/use-agent.sh

# Use a specific agent
./.claude/use-agent.sh pr-guardian "Review PR #613"
```

### Method 3: Copy Agent Instructions
1. Open the agent file in `.claude/agents/`
2. Copy the agent description
3. Paste as context when starting a task

## Available Agents

### GitHub/PR Agents
- `pr-guardian` - PR quality and security reviews
- `pr-decomposer` - Break down large PRs
- `pr-conflict-resolver` - Resolve merge conflicts
- `issue-triage-specialist` - Organize and prioritize issues
- `release-coordinator` - Manage releases
- `version-control-agent` - Git operations expert

### Engineering Agents
- `development-agent` - General development tasks
- `fynlo-api-optimizer` - API performance optimization
- `fynlo-bundle-deployer` - iOS/Android bundle deployment
- `fynlo-code-hygiene-agent` - Code quality maintenance
- `fynlo-websocket-debugger` - WebSocket issue resolution
- `payment-flow-optimizer` - Payment system optimization

### Testing Agents
- `fynlo-test-runner` - Automated test execution
- `pos-scenario-tester` - POS-specific test scenarios
- `testing-agent` - General testing tasks

### Security Agents
- `fynlo-security-auditor` - Security vulnerability scanning
- `multi-tenant-guardian` - Multi-tenancy isolation checks

### Operations Agents
- `fynlo-infrastructure-manager` - Infrastructure management
- `setup-agent` - Environment setup

### Planning Agents
- `planning-agent` - Project planning
- `documentation-agent` - Documentation tasks
- `research-agent` - Technical research

## Workaround Until Fixed

For now, when you need specialized agent behavior:

1. **Specify the agent role explicitly**:
   "Act as the PR Guardian agent to review this pull request"

2. **Reference the agent file**:
   "Use the instructions from .claude/agents/github/pr-guardian.md"

3. **Copy key responsibilities** from the agent file into your prompt

## Note
This is a temporary situation. The agent system may be restored in a future Cursor update or through a configuration change. The agent descriptions remain valuable as they define specialized behaviors and expertise areas.