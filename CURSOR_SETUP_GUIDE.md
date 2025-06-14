# 🤖 Cursor AI Setup Guide for Fynlo POS

## Quick Start with Cursor

### 1. Initial Setup
```bash
# Open the Fynlo POS project in Cursor
cursor /path/to/cashapp-fynlo

# Cursor will automatically detect the .cursorrules file
# and apply the development guidelines
```

### 2. Verify Cursor Configuration
- ✅ Cursor should show: "Rules detected: .cursorrules"
- ✅ AI suggestions should respect the defined boundaries
- ✅ File modification warnings should appear for protected files

### 3. Start Development
```bash
# Check available branches
git branch -a

# Choose your assigned feature branch
git checkout feature/backend-api-endpoints
# or
git checkout feature/ios-app-enhancement
# etc.

# Create your working branch
git checkout -b feature/backend-api-endpoints/authentication-endpoints
```

## Cursor AI Interaction Guidelines

### ✅ Good Prompts for Cursor:
```
"Create a new React Native component for order management 
following the existing patterns in src/components/"

"Implement a new API endpoint for user authentication 
in addons/point_of_sale_api/controllers/"

"Add unit tests for the payment processing service"

"Optimize the database query in the orders model"
```

### ❌ Avoid These Prompts:
```
"Refactor the entire project structure"
"Update all dependencies to latest versions"
"Change the database configuration"
"Modify the main README or documentation"
```

## Feature-Specific Development

### Backend Development (Python/Odoo)
When working on backend features, tell Cursor:
```
"I'm working on backend API development. Please:
1. Follow the BACKEND_API_TASKS.md documentation
2. Create new endpoints in addons/point_of_sale_api/
3. Follow Odoo ORM patterns
4. Add proper authentication and validation
5. Include unit tests for all new functions"
```

### iOS Development (React Native)
When working on iOS features, tell Cursor:
```
"I'm working on iOS app enhancement. Please:
1. Follow the IOS_APP_TASKS.md documentation  
2. Use TypeScript for all new components
3. Follow the existing component patterns
4. Add proper type definitions
5. Include component tests"
```

### Payment Integration
When working on payment features, tell Cursor:
```
"I'm working on payment integration. Please:
1. Follow PCI compliance guidelines
2. Never log sensitive payment data
3. Use secure API patterns
4. Implement proper error handling
5. Add comprehensive tests"
```

## Cursor Workspace Configuration

### Recommended Extensions
Cursor should suggest these extensions for the project:
- **TypeScript**: For iOS development
- **Python**: For backend development
- **ESLint**: Code quality
- **Prettier**: Code formatting
- **GitLens**: Git integration
- **Test Runner**: For running tests

### File Associations
```json
{
  "files.associations": {
    "*.tsx": "typescriptreact",
    "*.ts": "typescript", 
    "*.py": "python",
    "*.xml": "xml"
  }
}
```

## Development Workflow with Cursor

### 1. Task Selection
```bash
# Before starting, tell Cursor which task you're working on:
"I'm working on Task #3 from BACKEND_API_TASKS.md: 
Product & Menu Endpoints. Please help me implement 
the GET /api/v1/products endpoint."
```

### 2. Code Generation
- Let Cursor suggest implementations based on existing patterns
- Always review generated code for security and performance
- Ensure tests are included with new functionality

### 3. Testing with Cursor
```bash
# Ask Cursor to help with testing:
"Generate unit tests for the new authentication endpoint
following the existing test patterns in the project"
```

### 4. Code Review
```bash
# Before committing, ask Cursor:
"Review this code for:
- Security vulnerabilities
- Performance issues  
- Compliance with project patterns
- Missing error handling"
```

## Cursor AI Limitations & Boundaries

### What Cursor Should Do:
- ✅ Generate new code following project patterns
- ✅ Suggest improvements to existing code
- ✅ Help with debugging and troubleshooting
- ✅ Create comprehensive tests
- ✅ Optimize performance where appropriate

### What Cursor Should NOT Do:
- ❌ Modify project documentation files
- ❌ Change core configuration files
- ❌ Delete existing functionality
- ❌ Bypass security measures
- ❌ Modify database schemas without explicit instruction

## Emergency Procedures

### If Cursor Suggests Dangerous Operations:
1. **Stop immediately** - Don't execute the suggestion
2. **Review the .cursorrules** file
3. **Restart Cursor** if it's not following rules
4. **Ask for help** if you're unsure about a suggestion

### If Something Goes Wrong:
```bash
# Immediately revert changes
git checkout -- .

# Or reset to last known good state
git reset --hard HEAD

# Report the issue
```

## Best Practices for Cursor Collaboration

### 1. Context Setting
Always provide context when asking Cursor for help:
```
"I'm implementing the order management system for a restaurant POS. 
The order needs to track items, quantities, modifications, and 
calculate taxes. Please create a TypeScript interface and 
React component following our existing patterns."
```

### 2. Incremental Development
- Work on one feature at a time
- Test each change before moving forward
- Commit frequently with descriptive messages

### 3. Code Quality Checks
Ask Cursor to:
- Review code for edge cases
- Suggest error handling improvements
- Identify potential security issues
- Recommend performance optimizations

### 4. Documentation
Have Cursor help with:
- Adding inline code comments
- Creating function documentation
- Updating relevant README sections (when appropriate)

## Monitoring Cursor Behavior

### Watch for These Patterns:
- ✅ Cursor suggests code that follows project patterns
- ✅ Generated code includes proper error handling
- ✅ Suggestions respect the .cursorrules boundaries
- ✅ Tests are automatically included with new features

### Red Flags:
- 🚨 Cursor suggests modifying protected files
- 🚨 Generated code lacks security considerations
- 🚨 Suggestions don't follow established patterns
- 🚨 No tests provided with new functionality

## Success Checklist

Before considering a Cursor-assisted development session complete:
- [ ] All generated code follows project standards
- [ ] Tests are written and passing
- [ ] No protected files were modified
- [ ] Security guidelines were followed
- [ ] Performance impact was considered
- [ ] Code is properly documented
- [ ] Changes are committed with good messages

---

**Remember**: Cursor is a powerful tool, but you're the developer in charge. Always review, test, and understand the code before accepting suggestions!