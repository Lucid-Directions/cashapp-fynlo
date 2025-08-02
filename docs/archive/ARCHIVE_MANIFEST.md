# Archive Manifest

**Date of Archival**: August 2, 2025  
**Archival Branch**: `chore/archive-outdated-markdown-docs`

## Purpose

This archive contains outdated markdown documentation files that are no longer actively used in the Fynlo POS project. The files have been organized by category to maintain historical context while cleaning up the root directory structure.

## Archive Structure

```
docs/archive/
├── pr-analysis/        # PR Guardian analysis and PR review documents
├── migration-reports/  # Code migration and fix reports
├── cleanup-reports/    # Code cleanup and refactoring reports
├── pr-tasks/          # PR-specific task files
└── misc/              # Miscellaneous outdated documentation
```

## Files Archived

### PR Analysis Files (pr-analysis/)
- PR_414_SECURITY_FIXES.md (from root)
- PR_431_GUARDIAN_ANALYSIS.md (from root)
- pr-353-comprehensive-review.md (from tasks/)
- PR_426_GUARDIAN_ANALYSIS.md (from root)
- PR_430_GUARDIAN_ANALYSIS.md (from root)
- PR_GUARDIAN_ANALYSIS.md (from root)
- PR_414_FINAL_SECURITY_ASSESSMENT.md (from root)
- PR_428_GUARDIAN_ANALYSIS.md (from root)
- PR_428_FINAL_GUARDIAN_REPORT.md (from root)
- PR_436_GUARDIAN_ANALYSIS.md (from backend/)
- PR_438_GUARDIAN_ANALYSIS.md (from backend/)
- PR-479-SUMMARY.md (from CashApp-iOS/CashAppPOS/)

### Migration Reports (migration-reports/)
- react-hooks-migration.md (from .react-hooks-migration.md)
- DIGITALOCEAN_REPLICA_FIX_PLAN.md (from root)
- SQL_INJECTION_FIX_REPORT.md (from root)
- SQL_INJECTION_FIX_SUMMARY.md (from backend/)
- SECURITY_FIX_SUMMARY.md (from backend/)
- DOCSTRING_FIX_REPORT.md (from backend/)
- SYNTAX_ERROR_REPORT.md (from backend/)
- FYNLO_EXCEPTION_MIGRATION_TEST_REPORT.md (from backend/)
- MIGRATION_REPORT.md (from backend/)
- ERROR_HANDLING_SECURITY_REPORT.md (from root)
- GITHUB_ISSUE_FYNLO_EXCEPTION_MIGRATION.md (from backend/)
- HTTPEXCEPTION_MIGRATION_COMPLETE.md (from backend/)
- SECURITY_AUDIT_HTTPEXCEPTION_TO_FYNLOEXCEPTION.md (from backend/)

### Cleanup Reports (cleanup-reports/)
- CLEANUP_REPORT.md (from root)
- EXPERT_CLEANUP_REVIEW.md (from root)
- console-todo-cleanup.md (from .console-todo-cleanup.md)

### PR Tasks (pr-tasks/)
- pr-fix-workflow.md (from tasks/)
- fix-textinput-onboarding.md (from tasks/)
- fix-auth-issues.md (from tasks/)
- fix-react-native-styles.md (from CashApp-iOS/CashAppPOS/tasks/)

### Miscellaneous (misc/)
- TEST_ANALYSIS_REPORT.md (from root)
- ISSUE_ANALYSIS_REPORT.md (from backend/)
- test_coverage_report.md (from backend/)
- CURSOR_BOT_FIXES_SUMMARY.md (from backend/)
- ISSUE_389_MIDDLEWARE_ASSESSMENT.md (from backend/)
- REVERT_CONTEXT.md (from backend/)
- REVERT_PLAN_af057592.md (from backend/)
- TENANT_SECURITY_IMPLEMENTATION_GUIDE.md (from backend/)
- TEST_COVERAGE_ANALYSIS.md (from backend/)

## Active Documentation Preserved

The following key documentation files remain in their original locations:
- CLAUDE.md (AI assistant instructions)
- CONTEXT.md (project context)
- README.md files (project documentation)
- PIECES_WORKFLOW.md (workflow documentation)
- RYAN_SETUP.md (developer setup guide)
- All files in DOCS/current-implementation/
- All files in DOCS/archived/ (already archived)

## Notes

- All files were moved using `git mv` to preserve version history
- No active documentation was archived
- Files already in DOCS/archived/ were left in place
- This cleanup reduces clutter in the root directory and improves project organization