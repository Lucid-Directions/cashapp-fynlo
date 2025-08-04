#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const branches = [
  { name: 'main', description: 'Baseline (main branch)', expectedReduction: 0 },
  { name: 'fix/style-warnings-phase1-pattern-conversion', description: 'Pattern conversion', expectedReduction: 300 },
  { name: 'fix/style-warnings-phase2-import-fixes', description: 'Import fixes', expectedReduction: 100 },
  { name: 'fix/style-warnings-phase3-navigation', description: 'Navigation', expectedReduction: 80 },
  { name: 'fix/style-warnings-phase4-forms', description: 'Forms', expectedReduction: 60 },
  { name: 'fix/style-warnings-phase5-misc', description: 'Misc', expectedReduction: 51 }
];

console.log('\n=== React Native Style Warnings Progress Monitor ===\n');

const results = [];
const cwd = process.cwd();
const projectPath = path.join(cwd, 'CashApp-iOS', 'CashAppPOS');

for (const branch of branches) {
  try {
    console.log(`\n🔍 Testing branch: ${branch.name}`);
    console.log(`   Description: ${branch.description}`);
    
    // Switch to branch
    try {
      execSync(`git checkout ${branch.name}`, { cwd, stdio: 'pipe' });
    } catch (error) {
      console.log(`   ⚠️  Branch ${branch.name} not found locally, skipping...`);
      continue;
    }
    
    // Count warnings
    try {
      const lintOutput = execSync('npm run lint 2>&1', { cwd: projectPath, encoding: 'utf8' });
      
      // Count style-related warnings
      const styleWarnings = (lintOutput.match(/no-inline-styles|no-unused-styles/g) || []).length;
      
      console.log(`   📊 Style warnings: ${styleWarnings}`);
      
      results.push({
        branch: branch.name,
        description: branch.description,
        warningCount: styleWarnings,
        expectedReduction: branch.expectedReduction
      });
      
    } catch (lintError) {
      console.log(`   ❌ Lint failed for ${branch.name}`);
      console.log(`   Error: ${lintError.message.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing ${branch.name}: ${error.message}`);
  }
}

console.log('\n=== PROGRESS SUMMARY ===\n');

if (results.length > 0) {
  const baseline = results.find(r => r.branch === 'main')?.warningCount || 591;
  console.log(`📈 Baseline warnings (main): ${baseline}`);
  console.log(`🎯 Target: 0 warnings`);
  console.log(`\nProgress by phase:`);
  
  let totalReduced = 0;
  results.forEach((result, index) => {
    if (result.branch === 'main') return;
    
    const reduction = baseline - result.warningCount;
    totalReduced += Math.max(0, reduction);
    const percentage = ((reduction / baseline) * 100).toFixed(1);
    
    console.log(`\n${index}. ${result.description}`);
    console.log(`   Branch: ${result.branch}`);
    console.log(`   Current warnings: ${result.warningCount}`);
    console.log(`   Warnings reduced: ${reduction} (${percentage}%)`);
    console.log(`   Expected reduction: ~${result.expectedReduction}`);
    console.log(`   Status: ${reduction >= (result.expectedReduction * 0.8) ? '✅ On track' : '⚠️ Below target'}`);
  });
  
  const overallProgress = ((totalReduced / baseline) * 100).toFixed(1);
  console.log(`\n🏆 OVERALL PROGRESS:`);
  console.log(`   Total warnings reduced: ${totalReduced}/${baseline} (${overallProgress}%)`);
  console.log(`   Remaining warnings: ${baseline - totalReduced}`);
  
  // Save detailed results
  const reportPath = path.join(cwd, 'style-warnings-progress-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseline,
    results,
    summary: {
      totalReduced,
      remaining: baseline - totalReduced,
      overallProgress: overallProgress + '%'
    }
  }, null, 2));
  
  console.log(`\n📄 Detailed report saved to: style-warnings-progress-report.json`);
}

console.log('\n=== END REPORT ===\n');