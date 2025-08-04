# Setup Guide for Ryan - Fynlo POS Development

## Required Tools to Install

### 1. Python Development Tools
```bash
# Install Ruff (Python linter) - REQUIRED
pip install ruff

# Or using pipx (recommended)
pipx install ruff
```

### 2. MCP Servers (if using Claude Desktop)
```bash
# Tree-sitter MCP for syntax validation
npx -y @modelcontextprotocol/server-tree-sitter
```

### 3. Pre-commit Hooks - REQUIRED
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

## Environment Configuration

### Required Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**CRITICAL**: Generate the payment encryption key:
```bash
# Generate a secure encryption key for payment configurations
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add this key to your `.env` file as `PAYMENT_CONFIG_ENCRYPTION_KEY=<generated-key>`

⚠️ **Security Note**: This key encrypts sensitive payment provider credentials. Never commit this key to version control!

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

## Recent Changes (August 2025)

### Code Quality Initiative
We've created and merged 3 PRs to improve code quality:
- PR #506: Remove TypeScript `any` types ✅
- PR #507: Fix React hook dependencies ✅
- PR #508: Remove console statements and TODOs ✅

### CI/CD Improvements
- All checks are temporarily non-blocking during transition
- Once code quality is improved, checks will be strict again
- New workflow: `.github/workflows/code-quality-check.yml`

### Python Syntax Protection
After the "docstring incident" (83 files with syntax errors), we now have:
- Pre-commit hooks with Ruff
- Docker build-time validation
- CI/CD syntax checking
- Tree-sitter MCP for AST analysis

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

## Common Issues & Fixes

### Package-lock.json conflicts
```bash
rm -f package-lock.json
npm install --legacy-peer-deps
```

### Python import errors
- Check for unused imports (F401)
- Check for undefined names (F821)
- Run `ruff check backend/app --fix`

### TypeScript errors
- Currently non-blocking but should be fixed
- Run `npm run lint` in CashApp-iOS/CashAppPOS

## Questions?
Check CLAUDE.md for full documentation or message in Slack/Discord.