#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Installing pre-commit hooks..."
echo "================================"

# Install pre-commit if not already installed
if ! command -v pre-commit &> /dev/null; then
    echo -e "${YELLOW}Installing pre-commit...${NC}"
    pip install pre-commit
else
    echo -e "${GREEN}✅ pre-commit already installed${NC}"
fi

# Navigate to project root (parent of CashApp-iOS/CashAppPOS)
cd ../.. || exit 1

# Install the git hooks
echo -e "\n${BLUE}Installing git hooks...${NC}"
pre-commit install

# Run against all files to check current state
echo -e "\n${BLUE}Running pre-commit on all files (this may take a while)...${NC}"
pre-commit run --all-files || true

echo -e "\n${GREEN}✅ Pre-commit hooks installed!${NC}"
echo -e "${YELLOW}From now on, these checks will run automatically before each commit.${NC}"
echo -e "${BLUE}To skip hooks temporarily, use: git commit --no-verify${NC}"