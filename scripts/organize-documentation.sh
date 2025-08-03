#!/bin/bash

# Script to organize documentation files into DOCS folder
# Created: August 3, 2025

echo "Starting documentation organization..."

# Move PR analysis files
echo "Moving PR analysis files..."
git mv ./PR_414_SECURITY_FIXES.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_414_SECURITY_FIXES.md already moved"
git mv ./PR_431_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_431_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_426_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_426_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_430_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_430_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_414_FINAL_SECURITY_ASSESSMENT.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_414_FINAL_SECURITY_ASSESSMENT.md already moved"
git mv ./PR_428_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_428_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_428_FINAL_GUARDIAN_REPORT.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_428_FINAL_GUARDIAN_REPORT.md already moved"
git mv ./FYNLO_PR_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "FYNLO_PR_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_412_FINAL_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_412_FINAL_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_426_FINAL_GUARDIAN_ANALYSIS.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_426_FINAL_GUARDIAN_ANALYSIS.md already moved"
git mv ./PR_GUARDIAN_ANALYSIS_386.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_GUARDIAN_ANALYSIS_386.md already moved"
git mv ./PR_UPDATE.md DOCS/archive/pr-analysis/ 2>/dev/null || echo "PR_UPDATE.md already moved"

# Move migration reports
echo "Moving migration reports..."
git mv ./DIGITALOCEAN_REPLICA_FIX_PLAN.md DOCS/archive/migration-reports/ 2>/dev/null || echo "DIGITALOCEAN_REPLICA_FIX_PLAN.md already moved"
git mv ./SQL_INJECTION_FIX_REPORT.md DOCS/archive/migration-reports/ 2>/dev/null || echo "SQL_INJECTION_FIX_REPORT.md already moved"
git mv ./ERROR_HANDLING_SECURITY_REPORT.md DOCS/archive/migration-reports/ 2>/dev/null || echo "ERROR_HANDLING_SECURITY_REPORT.md already moved"

# Move cleanup reports
echo "Moving cleanup reports..."
git mv ./CLEANUP_REPORT.md DOCS/archive/cleanup-reports/ 2>/dev/null || echo "CLEANUP_REPORT.md already moved"
git mv ./EXPERT_CLEANUP_REVIEW.md DOCS/archive/cleanup-reports/ 2>/dev/null || echo "EXPERT_CLEANUP_REVIEW.md already moved"

# Move optimization and misc files
echo "Moving misc documentation..."
git mv ./OPTIMIZATION_SUMMARY.md DOCS/archive/misc/ 2>/dev/null || echo "OPTIMIZATION_SUMMARY.md already moved"
git mv ./TEST_ANALYSIS_REPORT.md DOCS/archive/misc/ 2>/dev/null || echo "TEST_ANALYSIS_REPORT.md already moved"

# Check if any markdown files remain in root that should be archived
echo ""
echo "Checking for remaining markdown files in root..."
echo "Files that will remain in root (essential documentation):"
echo "- CLAUDE.md (AI assistant instructions)"
echo "- CONTEXT.md (project context)"
echo "- README.md (project readme)"
echo "- PIECES_WORKFLOW.md (workflow documentation)"
echo "- PIECES_INTEGRATION.md (integration guide)"
echo "- BREAKING_CHANGES.md (breaking changes log)"
echo "- DIGITALOCEAN_OPTIMIZATION.md (optimization guide)"

echo ""
echo "Documentation organization complete!"
echo "All PR analysis, migration reports, and cleanup documentation moved to DOCS/archive/"