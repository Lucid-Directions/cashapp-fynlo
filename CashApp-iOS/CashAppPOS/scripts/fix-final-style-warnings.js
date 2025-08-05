#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the warnings file
const warnings = fs.readFileSync('remaining-warnings.txt', 'utf8').split('\n').filter(line => line.trim());

// Group warnings by file
const warningsByFile = {};
warnings.forEach(line => {
  const match = line.match(/^\/Users\/[^:]+\/([^:]+):(\d+):(\d+)\s+warning\s+(.+)/);
  if (match) {
    const [, relativePath, lineNum, colNum, message] = match;
    const fullPath = `/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/CashApp-iOS/CashAppPOS/${relativePath}`;
    if (!warningsByFile[fullPath]) {
      warningsByFile[fullPath] = [];
    }
    warningsByFile[fullPath].push({
      line: parseInt(lineNum),
      column: parseInt(colNum),
      message: message.trim()
    });
  }
});

// Fix each file
Object.entries(warningsByFile).forEach(([filePath, warnings]) => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  // Sort warnings by line number in reverse order to avoid line number shifts
  warnings.sort((a, b) => b.line - a.line);

  warnings.forEach(warning => {
    if (warning.message.includes('Inline style:')) {
      // Extract the inline style
      const styleMatch = warning.message.match(/Inline style: ({[^}]+})/);
      if (styleMatch) {
        const inlineStyle = styleMatch[1];
        const lineIndex = warning.line - 1;
        
        if (lines[lineIndex]) {
          // Handle specific cases
          if (inlineStyle.includes('flexDirection') && inlineStyle.includes('flexWrap')) {
            lines[lineIndex] = lines[lineIndex].replace(/style={{[^}]+}}/, 'style={styles.customerChipContainer}');
            modified = true;
          } else if (inlineStyle === '{ flex: 1, marginRight: 8 }') {
            lines[lineIndex] = lines[lineIndex].replace(/style={{[^}]+}}/, 'style={styles.buttonLeft}');
            modified = true;
          } else if (inlineStyle === '{ flex: 1, marginLeft: 8 }') {
            lines[lineIndex] = lines[lineIndex].replace(/style={{[^}]+}}/, 'style={styles.buttonRight}');
            modified = true;
          } else if (inlineStyle.includes('rgba(255, 255, 255, 0.8)')) {
            lines[lineIndex] = lines[lineIndex].replace(/style={{[^}]+}}/, 'style={styles.whiteTranslucent}');
            modified = true;
          } else if (inlineStyle.includes('selectedSection === item.id')) {
            // This is a dynamic style - needs special handling
            lines[lineIndex] = lines[lineIndex].replace(
              /style={{[^}]+}}/,
              'style={[styles.sectionText, selectedSection === item.id && styles.sectionTextSelected]}'
            );
            modified = true;
          }
        }
      }
    } else if (warning.message.includes('Unused style detected:')) {
      // Handle unused styles
      const styleMatch = warning.message.match(/Unused style detected: ([^\s]+)/);
      if (styleMatch) {
        const unusedStyle = styleMatch[1];
        
        // Special handling for qrWrapperStyles and undefined styles
        if (unusedStyle.includes('qrWrapperStyles.')) {
          // These are actually used in QRCodePayment.tsx
          console.log(`ℹ️  Skipping false positive: ${unusedStyle}`);
        } else if (unusedStyle.includes('undefined.')) {
          // These need to be removed from the file
          const styleName = unusedStyle.replace('undefined.', '');
          // Find and remove the style definition
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`${styleName}:`) && lines[i].includes('{')) {
              // Find the closing brace
              let braceCount = 1;
              let j = i + 1;
              while (j < lines.length && braceCount > 0) {
                if (lines[j].includes('{')) braceCount++;
                if (lines[j].includes('}')) braceCount--;
                if (braceCount === 0) {
                  // Remove lines from i to j
                  lines.splice(i, j - i + 1);
                  modified = true;
                  break;
                }
                j++;
              }
              break;
            }
          }
        }
      }
    }
  });

  if (modified) {
    // Add missing styles to StyleSheet.create if needed
    const styleSheetIndex = lines.findIndex(line => line.includes('StyleSheet.create({'));
    if (styleSheetIndex !== -1) {
      const insertIndex = styleSheetIndex + 1;
      const stylesToAdd = [];

      // Check which styles need to be added
      const contentStr = lines.join('\n');
      if (contentStr.includes('styles.customerChipContainer') && !contentStr.includes('customerChipContainer:')) {
        stylesToAdd.push(`  customerChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },`);
      }
      if (contentStr.includes('styles.buttonLeft') && !contentStr.includes('buttonLeft:')) {
        stylesToAdd.push(`  buttonLeft: {
    flex: 1,
    marginRight: 8,
  },`);
      }
      if (contentStr.includes('styles.buttonRight') && !contentStr.includes('buttonRight:')) {
        stylesToAdd.push(`  buttonRight: {
    flex: 1,
    marginLeft: 8,
  },`);
      }
      if (contentStr.includes('styles.whiteTranslucent') && !contentStr.includes('whiteTranslucent:')) {
        stylesToAdd.push(`  whiteTranslucent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },`);
      }
      if (contentStr.includes('styles.sectionText') && !contentStr.includes('sectionText:')) {
        stylesToAdd.push(`  sectionText: {
    color: '#2c3e50',
  },`);
      }
      if (contentStr.includes('styles.sectionTextSelected') && !contentStr.includes('sectionTextSelected:')) {
        stylesToAdd.push(`  sectionTextSelected: {
    color: '#fff',
  },`);
      }

      // Insert the new styles
      if (stylesToAdd.length > 0) {
        lines.splice(insertIndex, 0, ...stylesToAdd);
      }
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Fixed ${path.basename(filePath)}`);
  }
});

console.log('\n✨ Final style warning fixes complete!');