# 🗄️ **Fynlo POS Database Setup Guide**

This guide will help you set up the PostgreSQL database for the Fynlo POS backend system.

## 📋 **Prerequisites**

- Python 3.8+ with pip
- PostgreSQL 12+ installed and running
- Admin access to create databases and users

## 🚀 **Quick Setup (Recommended)**

Run the automated setup script:

```bash
cd backend
python setup_database.py
```

This script will:
1. ✅ Check PostgreSQL installation and service status
2. ✅ Create the `fynlo_pos` database and `fynlo_user` user
3. ✅ Test database connection
4. ✅ Run Alembic migrations to create all tables
5. ✅ Create sample data for testing
6. ✅ Set up upload directories

## 🔧 **Manual Setup (If Needed)**

### Step 1: Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)

### Step 2: Create Database and User

Connect to PostgreSQL as superuser:
```bash
sudo -u postgres psql
```

Create the database and user:
```sql
CREATE USER fynlo_user WITH PASSWORD 'fynlo_password';
CREATE DATABASE fynlo_pos OWNER fynlo_user;
GRANT ALL PRIVILEGES ON DATABASE fynlo_pos TO fynlo_user;
\q
```

### Step 3: Configure Environment

Copy the environment template:
```bash
cp .env.example .env
```

Update the `.env` file with your settings:
```env
DATABASE_URL="postgresql://fynlo_user:fynlo_password@localhost:5432/fynlo_pos"
SECRET_KEY="your-super-secret-key-change-in-production"
DEBUG=true
```

### Step 4: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 5: Run Database Migrations

```bash
alembic upgrade head
```

### Step 6: Test the Setup

```bash
python test_database_functionality.py
```

## 📊 **Database Schema Overview**

The database includes the following main tables:

### **Core Tables**
- `platforms` - Multi-tenant platform management
- `restaurants` - Individual restaurant configurations
- `users` - User accounts with role-based access
- `customers` - Customer management and loyalty

### **Menu Management**
- `categories` - Menu categories
- `products` - Menu items with modifiers and pricing

### **Order Processing**
- `orders` - Customer orders with items and status
- `payments` - Payment transactions
- `qr_payments` - QR code payment tracking

## 🧪 **Testing Database Functionality**

After setup, run the comprehensive test suite:

```bash
python test_database_functionality.py
```

This will test:
- ✅ Database connection
- ✅ User CRUD operations
- ✅ Authentication system
- ✅ Platform/restaurant relationships
- ✅ Product management
- ✅ Order management
- ✅ JSON field storage

## 👤 **Default Login Credentials**

The setup creates these test accounts:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Platform Owner | admin@fynlo.com | admin123 | Full system access |
| Restaurant Owner | manager@fynlo.com | manager123 | Restaurant management |
| Employee | employee@fynlo.com | employee123 | POS operations |

## 🔧 **Troubleshooting**

### PostgreSQL Connection Issues

**Error: "connection refused"**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Start PostgreSQL
brew services start postgresql        # macOS
sudo systemctl start postgresql       # Linux
```

**Error: "authentication failed"**
```bash
# Reset PostgreSQL user password
sudo -u postgres psql
ALTER USER fynlo_user WITH PASSWORD 'fynlo_password';
```

### Migration Issues

**Error: "alembic command not found"**
```bash
pip install alembic
```

**Error: "table already exists"**
```bash
# Reset migrations (WARNING: This will delete all data)
alembic downgrade base
alembic upgrade head
```

### Python Import Issues

**Error: "ModuleNotFoundError"**
```bash
# Make sure you're in the backend directory
cd backend
python -m pip install -r requirements.txt
```

## 📈 **Performance Optimization**

For production deployment, consider these optimizations:

### Database Configuration
```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;

-- Optimize memory usage
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Restart PostgreSQL to apply changes
```

### Indexing
The schema includes optimized indexes for:
- User lookups by email
- Order queries by restaurant and date
- Product searches by category
- Payment tracking by order

## 🚀 **Next Steps**

After successful database setup:

1. **Start the backend server:**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

2. **Test API endpoints:**
   Visit [http://localhost:8000/docs](http://localhost:8000/docs)

3. **Connect the iOS app:**
   Update the iOS app configuration to point to your backend

4. **Test full functionality:**
   Create orders, process payments, test real-time updates

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Run the test suite to identify specific problems
3. Review the database logs for detailed error messages
4. Ensure all prerequisites are met

---

**Database Setup Complete!** 🎉

Your Fynlo POS database is now ready for development and testing.