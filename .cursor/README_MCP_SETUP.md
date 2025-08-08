# MCP Setup (Cursor + Terminal)

This repo includes a ready-to-use Model Context Protocol (MCP) setup for Cursor.
It adds developer tooling as MCP servers you can invoke from Cursor or the terminal.

## What this gives you
- Central config at `.cursor/mcp.json` (or template you can copy)
- Helper scripts to install CLIs and register servers
- One-click install links for Cursor via deeplink

## Prereqs
- macOS (zsh/bash)
- Homebrew (recommended)
- Cursor editor installed

## Install the CLIs
```bash
./scripts/mcp/install_cli_tools.sh
```
This ensures: doctl (DigitalOcean), semgrep, supabase, gh, trivy are present.

## Configure environment
Create `.cursor/.env.mcp` and fill secrets:
```bash
cat > .cursor/.env.mcp <<'EOF'
DIGITALOCEAN_ACCESS_TOKEN=
SUPABASE_ACCESS_TOKEN=
OPENAI_API_KEY=
GITHUB_TOKEN=
EOF
```

Load env when launching servers (the wrapper does this automatically).

## MCP config
Copy the template to active config and edit paths if needed:
```bash
cp .cursor/mcp.template.json .cursor/mcp.json
```

## One-click install links (Cursor deeplink)
Generate the deeplink for any server defined in the config:
```bash
./scripts/mcp/generate_deeplink.sh digitalocean-mcp
```
This prints a `cursor://anysphere.cursor-deeplink/mcp/install?...` link.
Open it in Cursor to register the server.

## Running from terminal
Some servers are command-based and will spawn on demand when Cursor calls them.
You can also dry-run servers directly via their wrappers in `scripts/mcp/servers/`.

## Files
- `.cursor/mcp.template.json` – template MCP config
- `.cursor/.env.mcp` – secrets (not committed)
- `scripts/mcp/install_cli_tools.sh` – CLI installers
- `scripts/mcp/generate_deeplink.sh` – build Cursor deeplink
- `scripts/mcp/servers/*` – small wrappers exporting tool interfaces

## Docs
- Cursor MCP: https://docs.cursor.com/en/tools/developers
