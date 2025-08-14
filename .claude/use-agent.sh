#!/bin/bash

# Agent selector script for Fynlo POS
# Usage: ./use-agent.sh <agent-name> [additional context]

AGENT_DIR="/Users/ryandavidson/Desktop/cashapp-fynlo/.claude/agents"

# Function to find agent file
find_agent() {
    local agent_name="$1"
    find "$AGENT_DIR" -name "*${agent_name}*.md" -type f | head -1
}

# Main script
if [ $# -eq 0 ]; then
    echo "Available agents:"
    echo "=================="
    find "$AGENT_DIR" -name "*.md" -type f | while read -r file; do
        basename "$file" .md | sed 's/-/ /g'
    done | sort | column
    echo ""
    echo "Usage: $0 <agent-name> [additional context]"
    echo "Example: $0 pr-guardian 'Review PR #613'"
    exit 1
fi

AGENT_NAME="$1"
AGENT_FILE=$(find_agent "$AGENT_NAME")

if [ -z "$AGENT_FILE" ]; then
    echo "Agent '$AGENT_NAME' not found."
    echo "Try one of these:"
    find "$AGENT_DIR" -name "*.md" -type f -exec basename {} .md \; | sort
    exit 1
fi

# Extract agent description
AGENT_DESC=$(grep "^description:" "$AGENT_FILE" | cut -d: -f2- | sed 's/^ //')

echo "==================================="
echo "AGENT: $(basename "$AGENT_FILE" .md)"
echo "==================================="
echo "$AGENT_DESC"
echo ""
echo "Agent instructions loaded from: $AGENT_FILE"
echo ""
echo "Copy this prompt to Claude:"
echo "-----------------------------------"
echo "Please act as the $(basename "$AGENT_FILE" .md) agent."
echo "Your instructions are in: $AGENT_FILE"
if [ $# -gt 1 ]; then
    shift
    echo "Task: $*"
fi
echo "-----------------------------------"