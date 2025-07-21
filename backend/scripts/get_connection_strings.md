# How to Find Your Database Connection Strings in DigitalOcean

## For PostgreSQL Database (DATABASE_URL)

1. Go to https://cloud.digitalocean.com/databases
2. Click on your PostgreSQL database cluster
3. Click on "Connection Details" or "Overview"
4. Look for "Connection String" or "Connection Parameters"
5. Choose "Connection string" format
6. Select "Public network" (unless using VPC)
7. Copy the string that looks like:
   ```
   postgresql://doadmin:AVNS_xxxxxxxxxxxxx@your-db-name.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require
   ```

## For Redis/Valkey (REDIS_URL)

1. Go to https://cloud.digitalocean.com/databases
2. Click on your Redis/Valkey database cluster
3. Click on "Connection Details" or "Overview"
4. Look for "Connection String" or "Connection Parameters"
5. Choose "rediss://" format (with SSL)
6. Copy the string that looks like:
   ```
   rediss://default:AVNS_xxxxxxxxxxxxx@your-redis-name.b.db.ondigitalocean.com:25061
   ```

## Important Notes:

- **PostgreSQL** uses ports 25060 (direct) or 25061 (connection pooling)
- **Redis/Valkey** typically uses port 25061
- Always use SSL (`sslmode=require` for PostgreSQL, `rediss://` for Redis)
- The password starts with `AVNS_`

## If You Can't Find Them:

Run this command in DigitalOcean console to see current values:
```bash
env | grep -E "(DATABASE_URL|REDIS_URL)" | sed 's/AVNS_[^@]*/AVNS_HIDDEN/g'
```

This will show you the current values with passwords hidden.