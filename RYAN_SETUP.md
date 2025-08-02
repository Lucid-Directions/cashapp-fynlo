# Setup Guide for Ryan - Fynlo POS Development

## Required Tools to Install

### 1. Python Development Tools
```bash
# Install Ruff (Python linter)
pip install ruff

# Or using pipx (recommended)
pipx install ruff
```

### 2. MCP Servers (if using Claude Desktop)
```bash
# Tree-sitter MCP for syntax validation
npx -y @modelcontextprotocol/server-tree-sitter
```

### 3. Pre-commit Hooks
```bash
# Install pre-commit
pip install pre-commit

# Set up the hooks in the repo
cd /path/to/cashapp-fynlo
pre-commit install
```

### 4. DigitalOcean CLI (if not already installed)
```bash
# Install doctl
brew install doctl

# Authenticate (get token from DigitalOcean dashboard)
doctl auth init
```

### 5. GitHub CLI (if not already installed)
```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

## Verify Installation

Run these commands to verify everything is installed:

```bash
# Check Python tools
ruff --version
python -m compileall --version

# Check pre-commit
pre-commit --version

# Check DigitalOcean CLI
doctl account get

# Check GitHub CLI  
gh auth status
```

## Key Workflows to Know

### Before Pushing Code
1. Python files are automatically checked for syntax errors
2. Pre-commit hooks will run Ruff linting
3. CI/CD will validate everything before deployment

### Creating PRs
Always use feature branches and create detailed PRs:
```bash
git checkout -b fix/your-feature
# make changes
git add .
git commit -m "fix: description"
git push origin fix/your-feature
gh pr create
```

### Python Syntax Validation
We now have triple protection against Python syntax errors:
1. Pre-commit hooks (local)
2. Docker build validation
3. GitHub Actions CI

## Recent Changes

### Code Quality Initiative
We've created 3 PRs to improve code quality:
- PR #506: Remove TypeScript `any` types
- PR #507: Fix React hook dependencies  
- PR #508: Remove console statements and TODOs

### CI/CD Improvements
- All checks are temporarily non-blocking during transition
- Once code quality is improved, checks will be strict again

## MCP Configuration
If using Claude Desktop, add this to your MCP settings:
```json
{
  "tree-sitter": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-tree-sitter"]
  }
}
```

## Questions?
Check CLAUDE.md for full documentation or reach out in our team chat.