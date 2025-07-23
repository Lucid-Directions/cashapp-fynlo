#!/bin/bash
# Fix database by ensuring only Chucho restaurant exists with correct owner and menu

echo "🌮 Fixing database - Ensuring ONLY Chucho restaurant and menu"
echo "==========================================================="
echo ""
echo "This will:"
echo "1. Remove all other restaurants (Casa Estrella, Fynlo Mexican, etc.)"
echo "2. Ensure Chucho is owned by arnaud@luciddirections.co.uk"
echo "3. Clear ALL menu data"
echo "4. Load ONLY the Chucho menu"
echo ""

# Run the updated seed script
python seed_chucho_menu.py

echo ""
echo "✅ Database fix complete!"
echo "   - Only Chucho restaurant exists"
echo "   - Owned by arnaud@luciddirections.co.uk"
echo "   - Only Chucho menu loaded"