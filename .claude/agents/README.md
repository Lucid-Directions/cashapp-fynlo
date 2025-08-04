# Fynlo POS AI Agents

A comprehensive collection of specialized AI agents designed to accelerate Fynlo POS development, operations, and restaurant success.

## 📁 Organization

All agents are now organized by department for better maintainability. See [STRUCTURE.md](./STRUCTURE.md) for the complete directory layout and quick agent finder.

## 🏢 Department Structure

### 🔧 Engineering
Technical implementation and system optimization agents.

- **payment-flow-optimizer**: Payment integration, failure recovery, and conversion optimization
- **fynlo-security-auditor**: Vulnerability scanning and security compliance
- (Additional agents from original system to be migrated)

### 📊 Product  
Restaurant success and feature optimization agents.

- **restaurant-success-optimizer**: KPI analysis, performance optimization, plan recommendations
- **menu-engineering-advisor**: Menu profitability analysis, pricing psychology, layout optimization

### 🛡️ Security
System security and compliance agents.

- **multi-tenant-guardian**: Restaurant data isolation, access control, multi-tenant security

### 🍽️ POS Operations
Core POS functionality and restaurant operations.

- **order-flow-orchestrator**: Order processing, kitchen coordination, peak hour management
- **inventory-control-specialist**: Stock management, waste reduction, predictive ordering
- **staff-coordination-manager**: Scheduling, permissions, performance tracking

### 🤝 Customer Success
Restaurant onboarding and support.

- **restaurant-onboarding-specialist**: Setup guidance, training, go-live support

### 🧪 Testing
Quality assurance and reliability.

- **pos-scenario-tester**: Real-world testing, payment scenarios, stress testing

### 💻 GitHub
Development workflow and collaboration.

- **pr-conflict-resolver**: Merge conflict resolution, branch recovery
- **pr-decomposer**: Large PR breakdown, dependency management  
- **pr-guardian**: Automated PR review, quality gates
- **issue-triage-specialist**: Issue management, assignment, prioritization
- **release-coordinator**: Multi-platform releases, deployment orchestration

### 🚧 Operations
Infrastructure and monitoring (to be expanded).

### 🎨 Design
UX/UI optimization (to be added).

### 📈 Marketing
Growth and engagement (to be added).

## 🎯 Agent Selection Guide

### By Scenario

**"I'm implementing a new feature"**
- Start with `planning-agent` for architecture
- Use `development-agent` for implementation
- Run `fynlo-security-auditor` for security check
- Test with `pos-scenario-tester`

**"I have a large PR with conflicts"**
- Use `pr-decomposer` to break it down
- Apply `pr-conflict-resolver` for conflicts
- Run `pr-guardian` for quality check

**"Setting up a new restaurant"**
- Start with `restaurant-onboarding-specialist`
- Configure with `menu-engineering-advisor`
- Monitor with `restaurant-success-optimizer`

**"Optimizing restaurant operations"**
- Analyze with `restaurant-success-optimizer`
- Improve orders with `order-flow-orchestrator`
- Manage inventory with `inventory-control-specialist`
- Coordinate staff with `staff-coordination-manager`

**"Payment issues"**
- Debug with `payment-flow-optimizer`
- Test with `pos-scenario-tester`
- Secure with `fynlo-security-auditor`

## 🚀 Using Agents

Agents can be invoked in two ways:

1. **Automatic**: Describe your task and the appropriate agent will be triggered
2. **Explicit**: Use the Task tool and specify the agent name

Example:
```
"I need to analyze why orders are slow during lunch rush"
→ Automatically triggers order-flow-orchestrator

OR

"Use the Task tool with the order-flow-orchestrator agent to analyze lunch rush delays"
```

## 📋 Agent Capabilities

All agents have access to specific tools suited to their role:
- **Engineering agents**: Code editing, testing, deployment tools
- **Product agents**: Analytics, data analysis, documentation
- **Security agents**: Scanning, auditing, validation tools
- **GitHub agents**: Git operations, PR management, issue tracking

## 🔄 Agent Collaboration

Agents can work together for complex tasks:
1. `pr-decomposer` breaks down large changes
2. `pr-guardian` reviews each piece
3. `fynlo-security-auditor` validates security
4. `release-coordinator` manages deployment

## 📚 Best Practices

1. **Use agents proactively**: Don't wait for problems
2. **Combine agents**: Multiple perspectives improve outcomes
3. **Trust agent expertise**: They encode proven patterns
4. **Provide context**: More details enable better assistance

## 🆕 Adding New Agents

New agents should follow the established format:
- YAML frontmatter with name, description, examples, tools
- 500+ word system prompt
- Clear responsibilities and expertise
- Domain-specific knowledge
- Practical examples

Place agents in the appropriate department directory based on their primary function.

## 🔗 Integration with Existing Tools

These agents complement existing MCP tools:
- File System operations
- Sequential Thinking for planning
- Memory Bank for context
- Semgrep for security scanning
- DigitalOcean for infrastructure

---

Remember: These agents encode hard-won expertise from Fynlo's development journey. Use them to avoid past mistakes and accelerate future success.