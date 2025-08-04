# CLAUDE.md - Fynlo POS Development Guide

## 🚨 CRITICAL: Pre-Commit Hooks Are Active!
**Pre-commit hooks automatically run on EVERY commit** to prevent syntax errors and maintain code quality. If a commit fails, fix the issues and try again.

```bash
# Test hooks manually
pre-commit run --all-files

# Emergency bypass (USE SPARINGLY)
git commit --no-verify -m "message"

# Install if missing
pip install pre-commit && pre-commit install
```

## 🚨 PR WORKFLOW - MANDATORY
1. **Always create feature branch**: `git checkout -b fix/descriptive-name`
2. **Create detailed PR with What/Why/Testing sections**
3. **Fix Cursor bot findings within same PR** (never create new PR for fixes unless the task is too big)
4. **Wait for all checks to pass before merging, i merge all PR after my review**
5. **Plan the work To be distributed amongst the agents.Then use multiple agents in parallel.Make sure the work is distributed to the specialized agents**

## 🛠️ Quick Reference

### Python Quality (MANDATORY before commits)
```bash
# Quick syntax check after edits
cd backend && python3 -m py_compile path/to/file.py

# Before commits
cd backend && ruff check app/ --fix && black app/

# Full quality check
python3 scripts/python-quality-check.py --backend-path backend
```

### Available Quality Tools (from PR #459 extraction)
- `scripts/python-quality-check.py` - Runs 6 tools (Ruff, Black, MyPy, Flake8, Bandit, Pylint)
- `scripts/pr459_fixer.py` - Fixes common Python patterns
- `scripts/batch-resolve-conflicts.py` - Resolves merge conflicts
- Pre-commit hooks in `.pre-commit-config.yaml`

### iOS Bundle Fix
```bash
cd CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## 🏗️ Architecture

**Stack**: React Native + FastAPI + PostgreSQL + Redis + WebSockets
**Auth**: Supabase (website signup → mobile login)
**Deployment**: DigitalOcean (backend), Vercel (web)
**Multi-tenant**: Platform → Restaurants → Users

### Key Patterns
```python
# API Responses
from app.core.response_helper import APIResponseHelper
return APIResponseHelper.success(data=result)

# Error Handling (NOT HTTPException!)
raise FynloException(message="Error", status_code=400)

# Money Fields
price = Column(DECIMAL(10, 2), nullable=False)
```

## 🔒 Security Checklist
- **Auth**: Role validation, restaurant isolation
- **Input**: Sanitize `< > " ' ( ) ; & + \` | \ *`
- **API**: Rate limiting, CORS, use APIResponseHelper
- **Data**: No secrets in code, HTTPS only

## 📚 Key Context

### PR #459 Success Story
**Problem**: Massive 424-file PR with 48K+ changes became unmergeable
**Solution**: Strategic decomposition into focused PRs:
- PR #468, #472, #473, #467, #514-516: Code improvements ✅
- PR #518: Automation tools (pre-commit, quality scripts) ✅
**Result**: 100% objectives achieved, zero production risk

### Critical Rules
- **NO ASSUMPTIONS**: Always verify code exists before using
- **GitHub Issues**: Check assignment before working (arnaud/Ryan collaboration)
- **Test Coverage**: Backend 80% pytest, Frontend Jest + RTL

## 🛠️ Available Tools

### MCP Servers
- File System, Sequential Thinking, Memory Bank
- Playwright/Puppeteer, SemGrep, Ref, Tree-sitter

### CLI Tools
- `pieces` - Context persistence
- `gh` - GitHub management
- `doctl` - DigitalOcean
- `trivy` - Security scanning

### Specialized Agents (in parallel via Task tool)
- fynlo-test-runner, fynlo-bundle-deployer
- fynlo-security-auditor, fynlo-api-optimizer
- planning-agent, development-agent, testing-agent

## 🚀 Common Commands

```bash
# Backend dev
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest backend/

# Security scan
trivy fs --scanners vuln backend/

# Pieces context
pieces search "recent work"
pieces create -n "fix-name"
```

## 📝 Remember
- Pre-commit hooks catch errors automatically
- Use FynloException, not HTTPException
- Always DECIMAL for money, never float
- Check issue assignment before working
- Keep PRs focused and testable