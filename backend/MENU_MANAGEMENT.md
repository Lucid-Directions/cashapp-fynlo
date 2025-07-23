# Menu Management Guide

## Overview
The Fynlo POS system uses a database-driven menu system. Each restaurant has its own menu that can be managed through the Menu Management screen in the app.

## Current Restaurant: Chucho
The system is currently configured with Chucho Mexican Restaurant as the primary client.

## Menu Structure
- **Categories**: Snacks, Tacos, Special Tacos, Burritos, Sides, Drinks
- **Products**: Each product belongs to a category and has name, price, description

## Fixing Menu Issues

### If you see old/wrong menu items in the POS:

1. **Quick Fix (Local Development)**
   ```bash
   cd backend
   ./fix_menu_now.sh
   ```

2. **Manual Fix**
   ```bash
   cd backend
   source venv/bin/activate
   python clear_and_load_chucho_menu.py
   ```

3. **Production Deployment**
   The menu will be automatically fixed on deployment via the Procfile release command.

## Menu Management Flow

### For Restaurant Managers:
1. Login to the POS app as a restaurant owner/manager
2. Go to Settings → App Settings → Menu Management
3. Use the interface to:
   - Add/edit categories
   - Add/edit menu items
   - Set prices and descriptions
   - Enable/disable items

### For Developers:
1. Menu data is stored in the `categories` and `products` tables
2. Each item is associated with a `restaurant_id`
3. The `clear_and_load_chucho_menu.py` script ensures only Chucho menu is loaded

## Important Notes
- The system supports multiple restaurants, but each restaurant has isolated menu data
- Menu changes made through the app are immediately reflected in the POS
- The seed scripts are only for initial setup - managers should use the app for ongoing changes

## Troubleshooting

### Menu not updating in app:
1. Pull to refresh on the POS screen
2. Check network connection
3. Verify the backend is running

### Wrong restaurant menu showing:
1. Run the `clear_and_load_chucho_menu.py` script
2. Check the `restaurant_id` in your user session

### Database connection issues:
1. Check your `.env` file has correct `DATABASE_URL`
2. Ensure PostgreSQL is running
3. Verify database migrations are up to date