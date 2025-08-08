#!/usr/bin/env bash
set -euo pipefail

# Installs common CLIs used by MCP server wrappers

# Detect brew path
BREW_BIN=$(command -v brew || true)
if [[ -z "$BREW_BIN" ]]; then
  echo "Homebrew not found. Install from https://brew.sh and rerun." >&2
  exit 1
fi

pkgs=(doctl semgrep supabase gh aquasecurity/trivy/trivy)

for pkg in "${pkgs[@]}"; do
  if brew list --formula | grep -q "^${pkg}$"; then
    echo "✓ ${pkg} already installed"
  else
    echo "Installing ${pkg}..."
    brew install ${pkg}
  fi
done

echo "All tools installed."
