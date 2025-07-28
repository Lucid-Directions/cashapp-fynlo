#!/usr/bin/env python3
"""
Sync Pieces snippets to Claude Code context
This script connects to Pieces OS API and exports snippets to Claude-readable format
"""

import requests
import json
import os
from datetime import datetime
from pathlib import Path

# Pieces OS API endpoints (adjust port if needed)
PIECES_API_BASE = "http://localhost:1000"
CLAUDE_CONTEXT_DIR = Path.home() / "Documents/Fynlo/cashapp-fynlo/.claude/context"

def check_pieces_connection():
    """Check if Pieces OS is running and accessible"""
    try:
        # Try common Pieces ports
        for port in [1000, 39300, 59597]:
            try:
                response = requests.get(f"http://localhost:{port}/", timeout=2)
                if response.status_code == 200:
                    print(f"✅ Connected to Pieces OS on port {port}")
                    return f"http://localhost:{port}"
            except:
                continue
        print("❌ Could not connect to Pieces OS")
        return None
    except Exception as e:
        print(f"❌ Error connecting to Pieces: {e}")
        return None

def export_pieces_to_claude():
    """Export Pieces snippets to Claude context format"""
    
    # Create context directory
    CLAUDE_CONTEXT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create output file
    output_file = CLAUDE_CONTEXT_DIR / "pieces-context.md"
    
    with open(output_file, 'w') as f:
        f.write(f"# Pieces Code Context\n\n")
        f.write(f"Last synced: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
        
        # Check Pieces connection
        api_base = check_pieces_connection()
        if not api_base:
            f.write("## ❌ Pieces OS Not Connected\n\n")
            f.write("Please ensure Pieces OS is running.\n")
            f.write("You can still add snippets manually below.\n\n")
        else:
            f.write("## ✅ Pieces OS Connected\n\n")
            f.write("Note: Direct API access to snippets requires Pieces API configuration.\n")
            f.write("For now, use Pieces app to export snippets and paste them below.\n\n")
        
        # Add placeholder sections
        f.write("## Code Snippets\n\n")
        f.write("### Authentication Patterns\n\n")
        f.write("```typescript\n")
        f.write("// Supabase auth pattern from Pieces\n")
        f.write("// Export from Pieces and paste here\n")
        f.write("```\n\n")
        
        f.write("### Common Fixes\n\n")
        f.write("```python\n")
        f.write("# WebSocket fixes from Pieces\n")
        f.write("# Export from Pieces and paste here\n")
        f.write("```\n\n")
        
        f.write("## Architecture Notes\n\n")
        f.write("- Multi-tenant isolation patterns\n")
        f.write("- Real-time WebSocket architecture\n")
        f.write("- Payment processing flow\n\n")
        
        f.write("## API Patterns\n\n")
        f.write("```python\n")
        f.write("# Standard response patterns\n")
        f.write("return APIResponseHelper.success(data=result)\n")
        f.write("```\n\n")
        
        f.write("---\n\n")
        f.write("## How to Add More Context\n\n")
        f.write("1. Save snippets in Pieces with #fynlo tag\n")
        f.write("2. Export from Pieces app (until API is available)\n")
        f.write("3. Paste exported content in this file\n")
        f.write("4. Claude will automatically use this context\n")
    
    print(f"✅ Context exported to: {output_file}")
    print("\nNext steps:")
    print("1. Open Pieces app")
    print("2. Export snippets with #fynlo tag")
    print("3. Paste them into the generated file")

if __name__ == "__main__":
    export_pieces_to_claude()