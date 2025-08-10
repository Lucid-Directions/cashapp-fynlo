#!/bin/bash

# Script to add missing logger imports to all files that use logger

echo "Finding and fixing files with missing logger imports..."

# Find all TypeScript/TSX files that use logger but don't import it
files_to_fix=$(grep -r "logger\." src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u | while read file; do
  if ! grep -q "import.*logger" "$file"; then
    echo "$file"
  fi
done)

if [ -z "$files_to_fix" ]; then
  echo "No files need logger import fixes"
  exit 0
fi

echo "Files that need logger import:"
echo "$files_to_fix"
echo ""

# Process each file
for file in $files_to_fix; do
  echo "Processing: $file"
  
  # Determine the relative path to utils/logger based on file location
  dir=$(dirname "$file")
  
  # Count how many directories deep we are from src/
  depth=$(echo "$dir" | tr '/' '\n' | grep -c .)
  
  # Build the relative import path
  if [[ "$dir" == "src/utils" ]]; then
    import_path="./logger"
  elif [[ "$dir" == "src/"* ]]; then
    # Count depth from src
    rel_depth=$(echo "$dir" | sed 's|^src/||' | tr '/' '\n' | grep -c .)
    if [ "$rel_depth" -eq 1 ]; then
      import_path="../utils/logger"
    elif [ "$rel_depth" -eq 2 ]; then
      import_path="../../utils/logger"
    else
      import_path="../../../utils/logger"
    fi
  else
    import_path="./utils/logger"
  fi
  
  # Check if file already has any imports
  if grep -q "^import" "$file"; then
    # Add after the first import group
    # Find the line number of the first import
    first_import_line=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
    
    # Check if logger import already exists (just in case)
    if ! grep -q "import.*logger.*from" "$file"; then
      # Add the import after React imports if they exist, otherwise after first import
      if grep -q "from 'react'" "$file"; then
        sed -i '' "/from 'react'/a\\
\\
import { logger } from '$import_path';
" "$file"
      else
        sed -i '' "${first_import_line}a\\
import { logger } from '$import_path';
" "$file"
      fi
      echo "  ✅ Added logger import with path: $import_path"
    else
      echo "  ⏭️  Logger import already exists"
    fi
  else
    # No imports in file, add at the beginning
    sed -i '' "1i\\
import { logger } from '$import_path';\\
\\
" "$file"
    echo "  ✅ Added logger import at beginning with path: $import_path"
  fi
done

echo ""
echo "✅ All logger imports have been added!"
echo ""
echo "Files modified:"
echo "$files_to_fix" | wc -l | tr -d ' '