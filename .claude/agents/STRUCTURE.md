# Agent Organization Structure

All agent markdown files are organized by department for better maintainability.

## 📁 Directory Structure

```
.claude/agents/
├── README.md                    # Main agents documentation
├── STRUCTURE.md                 # This file - organization guide
│
├── 🔧 engineering/              # Development & infrastructure agents
│   ├── development-agent.md
│   ├── fynlo-api-optimizer.md
│   ├── fynlo-bundle-deployer.md
│   ├── fynlo-code-hygiene-agent.md
│   ├── fynlo-websocket-debugger.md
│   └── payment-flow-optimizer.md
│
├── 💻 github/                   # Git, PR, and release management
│   ├── fynlo-pr-guardian.md
│   ├── issue-triage-specialist.md
│   ├── pr-conflict-resolver.md
│   ├── pr-decomposer.md
│   ├── pr-guardian.md
│   ├── release-coordinator.md
│   └── version-control-agent.md
│
├── 🛡️ security/                # Security and compliance
│   ├── fynlo-security-auditor.md
│   └── multi-tenant-guardian.md
│
├── 🍽️ pos-operations/          # Restaurant operations
│   ├── fynlo-pos-payment-agent.md
│   ├── inventory-control-specialist.md
│   ├── order-flow-orchestrator.md
│   └── staff-coordination-manager.md
│
├── 📊 product/                  # Product & business optimization
│   ├── fynlo-platform-integrator.md
│   ├── menu-engineering-advisor.md
│   └── restaurant-success-optimizer.md
│
├── 🤝 customer-success/         # Onboarding & support
│   └── restaurant-onboarding-specialist.md
│
├── 🧪 testing/                  # Quality assurance
│   ├── fynlo-test-runner.md
│   ├── pos-scenario-tester.md
│   └── testing-agent.md
│
├── 🚧 operations/               # DevOps & environment setup
│   ├── fynlo-infrastructure-manager.md
│   └── setup-agent.md
│
└── 📋 planning/                 # Architecture & documentation
    ├── documentation-agent.md
    ├── planning-agent.md
    └── research-agent.md
```

## 🎯 Quick Agent Finder

### By Task Type
- **Bug Fix**: `engineering/development-agent.md`
- **PR Issues**: `github/pr-guardian.md`, `github/pr-conflict-resolver.md`
- **Security Scan**: `security/fynlo-security-auditor.md`
- **Performance**: `engineering/fynlo-api-optimizer.md`
- **Testing**: `testing/fynlo-test-runner.md`
- **Documentation**: `planning/documentation-agent.md`

### By System Component
- **iOS Bundle**: `engineering/fynlo-bundle-deployer.md`
- **WebSocket**: `engineering/fynlo-websocket-debugger.md`
- **Payments**: `engineering/payment-flow-optimizer.md`, `pos-operations/fynlo-pos-payment-agent.md`
- **Multi-tenant**: `security/multi-tenant-guardian.md`, `product/fynlo-platform-integrator.md`
- **Infrastructure**: `operations/fynlo-infrastructure-manager.md`