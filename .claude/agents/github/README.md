# GitHub Department Agents

This department contains specialized agents for managing GitHub workflows, PRs, issues, and releases. These agents were created based on real experiences and pain points from the Fynlo development process.

## Available Agents

### 🔧 pr-conflict-resolver
**Purpose**: Resolve merge conflicts, especially in large PRs or complex rebases  
**Specialty**: Git surgery, conflict analysis, safe resolution strategies  
**Key Experience**: Handles situations like PR #459 (424 files, unmergeable)

### 📦 pr-decomposer
**Purpose**: Break down large PRs into manageable, reviewable chunks  
**Specialty**: Dependency analysis, logical separation, incremental delivery  
**Key Experience**: Prevents massive PRs like #459 from becoming unmergeable

### 🛡️ pr-guardian
**Purpose**: Automated PR review for quality, security, and standards  
**Specialty**: Code quality, security scanning, CI/CD debugging  
**Key Experience**: First-pass review catching issues before human review

### 📋 issue-triage-specialist
**Purpose**: Manage GitHub issues efficiently and prevent duplicate work  
**Specialty**: Issue organization, smart assignment, priority assessment  
**Key Experience**: Coordinates work between Ryan and Arnaud effectively

### 🚀 release-coordinator
**Purpose**: Orchestrate releases across iOS, backend, and web platforms  
**Specialty**: Deployment strategies, rollback plans, version compatibility  
**Key Experience**: Manages complex multi-platform releases safely

## Common Use Cases

1. **Large PR Problems**
   - Use `pr-decomposer` to split before conflicts arise
   - Use `pr-conflict-resolver` when already in conflict

2. **Quality Assurance**
   - Use `pr-guardian` for automated review on all PRs
   - Catches security issues, style violations, missing tests

3. **Work Organization**
   - Use `issue-triage-specialist` for daily issue management
   - Prevents duplicate work and ensures proper assignment

4. **Deployment**
   - Use `release-coordinator` for any production release
   - Ensures safe, coordinated deployments across platforms

## Lessons Learned

These agents encapsulate hard-won lessons from Fynlo's development:
- PR #459: 424-file PR that had to be decomposed into 8+ PRs
- PR #414: Security fixes that grew to 48K+ changes
- Multiple incidents of duplicate work on similar issues
- Complex deployments requiring iOS/backend coordination

## Integration with Other Departments

- **Security**: `pr-guardian` works with `fynlo-security-auditor`
- **Engineering**: All GitHub agents support engineering workflows
- **Operations**: `release-coordinator` interfaces with infrastructure agents

Remember: These agents are your first line of defense against GitHub chaos. Use them proactively to prevent problems, not just reactively to fix them.