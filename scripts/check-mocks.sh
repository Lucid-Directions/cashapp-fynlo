#!/usr/bin/env bash
# This script checks for forbidden mock-related imports in the src/ directory,
# excluding test-related directories.

# Define the pattern to search for.
# This pattern looks for "mockData", "mockFixture", or "mockGenerator".
PATTERN="mock(Data|Fixture|Generator)"

# Define directories to exclude from the search.
# Common test directories like __tests__, tests, and mocks.
EXCLUDE_DIRS="{__tests__,tests,mocks,*.test.ts,*.spec.ts}"

# Define the source directory to search within.
SOURCE_DIR="CashApp-iOS/CashAppPOS/src" # Adjusted to be more specific to the frontend source

# Run grep:
# -R: recursive
# -n: --line-number
# --exclude-dir: exclude specified directories
# -E: use extended regular expressions
# -q: quiet mode (suppress output, just exit status)
if grep -R --line-number --exclude-dir=$EXCLUDE_DIRS \
     -E "$PATTERN" "$SOURCE_DIR/"; then
  echo "---------------------------------------------------------------------"
  echo "❌ ERROR: Mock import detected in production code!"
  echo "---------------------------------------------------------------------"
  echo "The following files contain forbidden mock-related imports:"
  # Run grep again without -q to show the matches
  grep -R --line-number --exclude-dir=$EXCLUDE_DIRS \
       -E "$PATTERN" "$SOURCE_DIR/"
  echo "---------------------------------------------------------------------"
  echo "Please remove these imports or move them to test-specific directories."
  echo "---------------------------------------------------------------------"
  exit 1
else
  echo "✅ No forbidden mock imports detected in production code."
  exit 0
fi
