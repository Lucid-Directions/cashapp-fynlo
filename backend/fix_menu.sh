#!/bin/bash
# Fix menu by running the Chucho menu seed script which now clears all old data first

echo "🌮 Fixing menu - Loading ONLY Chucho menu"
echo "======================================="

# Run the updated seed script
python seed_chucho_menu.py

echo ""
echo "✅ Menu fix complete! Only Chucho menu should now be visible."