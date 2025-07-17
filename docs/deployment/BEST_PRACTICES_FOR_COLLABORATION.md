# 🤝 **Best Practices for Collaboration - Fynlo POS Project**

## **Git, GitHub & Team Coordination Guide**

**Project**: Fynlo POS - Hardware-Free Restaurant Management Platform  
**Team Structure**: Frontend (iOS/React Native) + Backend (FastAPI/PostgreSQL)  
**Repository**: https://github.com/Lucid-Directions/cashapp-fynlo  
**Created**: January 2025  

---

## 📋 **Quick Reference**

### **Daily Workflow Commands**
```bash
# Start of day - Get latest changes
git fetch origin
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-name-feature-description

# Regular commits
git add .
git commit -m "feat: descriptive message"
git push origin feature/your-name-feature-description

# End of day - Sync with team
git fetch origin
```

### **Emergency Commands**
```bash
# Undo last commit (if not pushed)
git reset --soft HEAD~1

# Discard local changes
git checkout -- .

# Get out of merge conflict state
git merge --abort

# See what changed
git diff
git log --oneline -10
```

---

## 🏗️ **Project Structure & Ownership**

### **Domain Separation**
```
Fynlo/
├── backend/                     # 👨‍💻 Ryan's Domain
│   ├── RYAN DOCS/              # Backend documentation
│   ├── app/                    # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── README.md              # Backend setup guide
│
├── CashApp-iOS/CashAppPOS/     # 👤 Your Domain  
│   ├── src/                    # React Native source
│   ├── ios/                    # iOS-specific files
│   ├── IOS DOCS/              # iOS documentation
│   └── package.json           # Node dependencies
│
├── ARCHIVED DOCS/              # 📚 Shared Historical Docs
├── config/                     # 🔧 Shared Configuration
└── *.md                       # 📝 Project-level docs
```

### **Ownership Guidelines**
- **Backend Developer (Ryan)**: Full ownership of `/backend/` directory
- **Frontend Developer (You)**: Full ownership of `/CashApp-iOS/` directory  
- **Shared Ownership**: Root-level documentation, configuration files
- **Coordination Required**: API integration, data formats, WebSocket events

---

## 🌿 **Branching Strategy**

### **Branch Naming Convention**

#### **Feature Branches**
```bash
# Frontend features
feature/frontend-navigation-enhancement
feature/ios-payment-integration
feature/mobile-offline-sync

# Backend features  
feature/ryan-file-upload-system
feature/ryan-websocket-events
feature/ryan-push-notifications

# Shared features
feature/api-standardization
feature/authentication-flow
```

#### **Bug Fixes**
```bash
# Frontend bugs
bugfix/ios-login-crash
bugfix/mobile-payment-validation

# Backend bugs
bugfix/ryan-auth-token-refresh
bugfix/ryan-database-connection

# Integration bugs
bugfix/api-response-format
bugfix/websocket-connection-drop
```

### **Branch Lifecycle**
```bash
# 1. Create from latest main
git checkout main
git pull origin main
git checkout -b feature/your-branch-name

# 2. Develop with regular commits
git add .
git commit -m "feat: implement specific functionality"

# 3. Push regularly (backup + collaboration)
git push origin feature/your-branch-name

# 4. Before merging - sync with main
git checkout main
git pull origin main
git checkout feature/your-branch-name
git merge main  # or git rebase main

# 5. Create Pull Request in GitHub
# 6. After review and merge - cleanup
git checkout main
git pull origin main
git branch -d feature/your-branch-name
```

---

## 🔄 **Daily Collaboration Workflow**

### **Morning Routine (5 minutes)**
```bash
# 1. Check what team members did overnight
git fetch origin
git log --oneline origin/main ^main  # See new commits

# 2. Update your main branch
git checkout main
git pull origin main

# 3. Check for new branches from teammates
git branch -r | grep -v HEAD

# 4. Continue your work or create new branch
git checkout your-current-branch
# OR
git checkout -b feature/new-feature
```

### **Throughout the Day**
```bash
# Commit frequently (every 1-2 hours of work)
git add .
git commit -m "feat: add user authentication form"

# Push regularly (end of each work session)
git push origin feature/your-branch

# Check for team updates (before starting major changes)
git fetch origin
```

### **End of Day Routine (3 minutes)**
```bash
# 1. Commit your current work
git add .
git commit -m "wip: working on payment integration"

# 2. Push your work (backup)
git push origin feature/your-branch

# 3. Check team progress
git fetch origin
git log --oneline origin/main ^main

# 4. Plan tomorrow's work based on team updates
```

---

## 📝 **Commit Message Best Practices**

### **Format Standard**
```
<type>(<scope>): <description>

<body>

<footer>
```

### **Type Conventions**
- **feat**: New feature for the user
- **fix**: Bug fix for the user
- **docs**: Documentation changes
- **style**: Code formatting (no logic changes)
- **refactor**: Code restructuring (no feature changes)
- **test**: Adding or updating tests
- **chore**: Build process, dependency updates

### **Good Examples**
```bash
# Frontend commits
git commit -m "feat(ios): add Apple Pay integration to payment screen"
git commit -m "fix(mobile): resolve crash on order submission"
git commit -m "docs(frontend): update setup guide for iOS development"

# Backend commits  
git commit -m "feat(api): implement file upload endpoint for menu images"
git commit -m "fix(auth): resolve JWT token refresh issue"
git commit -m "perf(db): optimize product query with proper indexing"

# Integration commits
git commit -m "feat(integration): standardize API response format"
git commit -m "fix(websocket): resolve connection drops on mobile"
```

---

## 🔍 **Code Review Process**

### **Creating Pull Requests**

#### **Before Creating PR**
```bash
# 1. Ensure your branch is up to date
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main

# 2. Run tests locally
npm test  # for frontend
pytest   # for backend

# 3. Review your own changes
git diff main...feature/your-branch
```

#### **PR Template**
```markdown
## 🎯 Purpose
Brief description of what this PR accomplishes

## 🔧 Changes Made
- [ ] Feature A implemented
- [ ] Bug B fixed  
- [ ] Documentation updated

## 🧪 Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## 📱 Mobile Impact (if applicable)
- [ ] iOS app tested
- [ ] API compatibility verified
- [ ] Performance impact assessed

## 🔗 Related Issues
Fixes #123
Relates to #456

## 📋 Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

---

## 🚨 **Conflict Resolution**

### **Merge Conflicts**
```bash
# When merge conflicts occur
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main

# Git will show conflicts in files
# Edit conflicted files, look for:
<<<<<<< HEAD
Your changes
=======
Their changes
>>>>>>> main

# After resolving conflicts
git add .
git commit -m "resolve: merge conflicts with main"
git push origin feature/your-branch
```

### **Preventing Conflicts**
1. **Sync frequently** - `git fetch origin` daily
2. **Small, focused PRs** - Easier to review and merge
3. **Communicate changes** - Discuss major refactoring
4. **Domain separation** - Frontend/backend boundaries
5. **Coordinate shared files** - API specs, documentation

---

## 📡 **GitHub Features for Collaboration**

### **Issues & Project Management**
```bash
# Link commits to issues
git commit -m "feat: implement login form (fixes #42)"

# Reference issues in PRs
git commit -m "refactor: extract payment logic (relates to #58)"
```

### **GitHub Features to Use**
1. **Issues** - Track bugs, features, questions
2. **Milestones** - Group related issues for releases
3. **Labels** - Categorize issues (bug, enhancement, documentation)
4. **Projects** - Kanban boards for workflow management
5. **Wiki** - Detailed documentation
6. **Releases** - Version management and deployment
7. **Discussions** - Team communication and questions

---

## 🔧 **Environment & Setup Coordination**

### **Configuration Management**
```bash
# Environment files (never commit)
.env
.env.local
.env.development

# Configuration templates (commit these)
.env.example
.env.template
```

### **Dependency Management**
```bash
# Backend (Python)
pip freeze > requirements.txt  # Update dependencies
pip install -r requirements.txt  # Install dependencies

# Frontend (Node.js)
npm install  # Install dependencies  
npm update   # Update dependencies
```

### **Database Coordination**
```bash
# Backend migrations (Ryan's responsibility)
alembic revision --autogenerate -m "add new table"
alembic upgrade head

# Database state sharing
# Use migration files, not database dumps
```

---

## 📱 **Frontend-Backend Integration**

### **API Integration Workflow**
1. **Backend creates endpoint** - Ryan implements API
2. **API documentation** - Swagger/OpenAPI docs updated
3. **Frontend integration** - You consume the API
4. **Testing together** - End-to-end testing
5. **Refinement** - Iterate based on frontend needs

### **Communication Points**
```bash
# When backend adds new endpoints
git pull origin main
# Check: backend/app/api/ for new routes

# When frontend needs API changes
# Create issue describing need
# Tag backend developer for discussion
```

### **Data Format Coordination**
```typescript
// Frontend TypeScript interfaces should match backend schemas
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
}
```

---

## 🧪 **Testing & Quality Assurance**

### **Testing Strategy**
1. **Unit tests** - Individual functions/components
2. **Integration tests** - API endpoints, database operations
3. **End-to-end tests** - Full user workflows
4. **Performance tests** - Load testing, response times
5. **Security tests** - Authentication, input validation

### **Testing Coordination**
```bash
# Run tests before pushing
npm test           # Frontend tests
pytest            # Backend tests

# Integration testing
# Start backend: npm run dev:backend
# Start frontend: npm run dev:frontend  
# Test user workflows manually
```

---

## 🚨 **Emergency Procedures**

### **Production Hotfixes**
```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Make minimal fix
# 3. Test thoroughly
# 4. Create emergency PR
# 5. Deploy immediately after review
# 6. Merge back to main and development branches
```

### **Broken Main Branch**
```bash
# 1. Identify the breaking commit
git log --oneline
git bisect start

# 2. Revert the problematic commit
git revert <commit-hash>
git push origin main

# 3. Notify team immediately
# 4. Fix in separate branch, then PR
```

---

## 📚 **Command Reference**

### **Essential Git Commands**
```bash
# Repository management
git clone <url>
git init
git remote add origin <url>

# Branch management
git branch                    # List local branches
git branch -r                 # List remote branches  
git branch -a                 # List all branches
git checkout <branch>         # Switch to branch
git checkout -b <branch>      # Create and switch to branch
git branch -d <branch>        # Delete local branch
git push origin --delete <branch>  # Delete remote branch

# Staging and committing
git add .                     # Stage all changes
git add <file>                # Stage specific file
git commit -m "message"       # Commit with message
git commit --amend            # Edit last commit

# Syncing with remote
git fetch origin              # Download changes (no merge)
git pull origin main          # Download and merge main
git push origin <branch>      # Upload branch
git push --set-upstream origin <branch>  # Set tracking

# Viewing history and changes
git log                       # View commit history
git log --oneline            # Compact history
git diff                     # View unstaged changes
git diff --staged            # View staged changes
git status                   # View repository status

# Merging and rebasing
git merge <branch>           # Merge branch into current
git rebase <branch>          # Rebase current onto branch
git merge --abort            # Cancel merge
git rebase --abort           # Cancel rebase

# Stashing
git stash                    # Save work temporarily
git stash pop                # Apply and remove stash
git stash list               # View all stashes
git stash apply stash@{0}    # Apply specific stash

# Undoing changes
git checkout -- <file>       # Discard file changes
git reset HEAD <file>        # Unstage file
git reset --soft HEAD~1      # Undo last commit (keep changes)
git reset --hard HEAD~1      # Undo last commit (lose changes)
git revert <commit>          # Create commit that undoes another
```

---

## 🎯 **Success Metrics**

### **Team Collaboration KPIs**
- **Merge conflicts**: < 1 per week per person
- **PR review time**: < 24 hours average
- **Build failures**: < 5% of commits
- **Test coverage**: > 80% maintained
- **Documentation coverage**: All new features documented

### **Communication Effectiveness**
- **Response time to questions**: < 4 hours during work hours
- **Standup participation**: Daily async updates
- **Knowledge sharing**: Weekly technical discussions
- **Blocker resolution**: < 24 hours average

---

## 🆘 **Troubleshooting Common Issues**

### **"I can't see my teammate's changes"**
```bash
# Solution: Fetch from remote
git fetch origin
git checkout main
git pull origin main
```

### **"My branch is behind main"**
```bash
# Solution: Merge main into your branch
git checkout your-branch
git merge main
# OR rebase (cleaner but more advanced)
git rebase main
```

### **"I have merge conflicts"**
```bash
# Solution: Resolve conflicts manually
# 1. Git will mark conflicted files
# 2. Edit files, remove conflict markers
# 3. Stage resolved files
git add .
git commit -m "resolve: merge conflicts"
```

### **"I committed to the wrong branch"**
```bash
# Solution: Cherry-pick to correct branch
git checkout correct-branch
git cherry-pick <commit-hash>
git checkout wrong-branch
git reset --hard HEAD~1  # Remove from wrong branch
```

### **"My local repository is messed up"**
```bash
# Nuclear option - start fresh (save work first!)
git stash                # Save current work
git fetch origin
git reset --hard origin/main
git stash pop           # Reapply your work
```

---

## 📞 **Team Communication**

### **Daily Standup Format**
```markdown
## Yesterday
- Completed: Feature X implementation
- Blocked by: API endpoint Y not ready

## Today  
- Plan: Integrate payment flow
- Need: Backend endpoint for payment confirmation

## Blockers
- None / Waiting for review of PR #123
```

### **Communication Channels**
- **Urgent issues**: Direct message/call
- **Daily updates**: Team chat
- **Technical discussions**: GitHub issues/discussions
- **Code reviews**: GitHub PR comments
- **Documentation**: GitHub wiki/README files

---

**Remember: Good collaboration is about communication, consistency, and consideration for your teammates. When in doubt, ask questions and document decisions!**

---

**Last Updated**: January 2025  
**Maintained By**: Fynlo Development Team  
**Next Review**: Monthly or as team grows 