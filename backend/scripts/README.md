# Database Seeding Scripts

This directory contains utility scripts for setting up and seeding the Fynlo POS database.

## Available Scripts

### 1. `create_restaurant.py`
Creates a restaurant with proper configuration in the database.

**Usage:**
```bash
# Create Chucho Restaurant (default)
python scripts/create_restaurant.py

# Create a custom restaurant
python scripts/create_restaurant.py --name "My Restaurant" --email "info@myrestaurant.com" --phone "+44 20 9876 5432"
```

**What it does:**
- Checks if the restaurant already exists
- Creates a restaurant with:
  - Business hours configuration
  - Tax settings (20% VAT)
  - Payment methods (cash, card, QR code)
  - Service charge (12.5%)
  - Address information

### 2. `seed_menu.py`
Seeds menu categories and products for a restaurant.

**Usage:**
```bash
# Seed menu for Chucho Restaurant (default)
python scripts/seed_menu.py

# Seed menu for a specific restaurant
python scripts/seed_menu.py --restaurant "My Restaurant"
```

**What it does:**
- Creates 6 menu categories (Snacks, Tacos, Special Tacos, Burritos, Sides, Drinks)
- Adds 37 menu items with descriptions and prices
- Skips items that already exist
- Shows progress and summary

## Prerequisites

1. Ensure you have the backend environment set up:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Ensure your `.env` file has the correct database connection string

3. The database must have:
   - A platform created
   - A platform owner user

## Running the Scripts

To set up a complete restaurant with menu:

```bash
cd backend

# Step 1: Create the restaurant
python scripts/create_restaurant.py

# Step 2: Seed the menu
python scripts/seed_menu.py
```

## Notes

- The scripts are idempotent - running them multiple times is safe
- Existing data will not be duplicated
- All timestamps use UTC
- Prices are stored as DECIMAL for accuracy
- The scripts use proper SQL parameterization for security