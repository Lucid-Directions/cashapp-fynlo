#!/bin/bash
# Fix Menu Now - Clear old menu and load only Chucho menu

echo "🌮 FIXING MENU - LOADING ONLY CHUCHO MENU"
echo "========================================"

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Run the clear and load script
python clear_and_load_chucho_menu.py

echo ""
echo "✅ Menu fix complete!"
echo "   - All old menu data has been removed"
echo "   - Only Chucho menu is now loaded"
echo "   - Restart your iOS app to see the changes"