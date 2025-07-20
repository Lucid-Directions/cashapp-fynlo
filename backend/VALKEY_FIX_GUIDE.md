# DigitalOcean Valkey (Redis) Connection Fix Guide

## Issue
The Valkey Redis instance is rejecting connections from your local development environment because your IP address is not in the trusted sources list.

## Solution Options

### Option 1: Add Your IP to Trusted Sources (Recommended for Development)

1. **Get your current IP address:**
   ```bash
   curl -s https://api.ipify.org
   ```

2. **In DigitalOcean Dashboard:**
   - Go to Databases → Your Valkey cluster
   - Click on "Settings" tab
   - Find "Trusted Sources" section
   - Click "Edit"
   - Add your IP address (from step 1)
   - Save changes

3. **Wait 1-2 minutes for changes to propagate**

4. **Test connection:**
   ```bash
   python3 test_valkey_connection.py
   ```

### Option 2: Use Local Redis for Development (Recommended)

1. **Using Docker (Easiest):**
   ```bash
   # Start Redis container
   docker run -d --name fynlo-redis -p 6379:6379 redis:alpine
   
   # Check it's running
   docker ps | grep fynlo-redis
   ```

2. **Using Homebrew (macOS):**
   ```bash
   # Install Redis
   brew install redis
   
   # Start Redis service
   brew services start redis
   ```

3. **Update your .env.development file:**
   ```env
   # Local Redis for development
   REDIS_URL="redis://localhost:6379/0"
   ```

4. **Create environment-specific configuration:**
   ```bash
   # Copy current .env to .env.production
   cp .env .env.production
   
   # Update .env.development with local Redis
   echo 'REDIS_URL="redis://localhost:6379/0"' >> .env.development
   ```

### Option 3: Configure Application for Multi-Environment Support

Create `.env.local` for local development:
```env
# Local development overrides
REDIS_URL="redis://localhost:6379/0"
DATABASE_URL="postgresql://fynlo_user:fynlo_password@localhost:5432/fynlo_pos"
ENVIRONMENT="development"
```

Update application to load environment-specific configs:
```python
# The app already loads .env.{APP_ENV} files
# Just set APP_ENV when starting:
APP_ENV=local uvicorn app.main:app --reload
```

## Production Deployment

For production deployments from DigitalOcean App Platform:
- The platform's IP addresses are automatically trusted
- No additional configuration needed
- The production REDIS_URL will work correctly

## Verification

After implementing any solution, verify with:
```bash
# Test connection
python3 test_valkey_connection.py

# Start the application
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
✅ Redis connected successfully.
```

Instead of:
```
❌ Failed to connect to Redis: TimeoutError
⚠️ Redis connection failed. Falling back to mock storage.
```

## Best Practices

1. **Development**: Use local Redis to avoid network latency and connection issues
2. **Staging**: Use a separate Valkey instance with staging server IPs trusted
3. **Production**: Use production Valkey with App Platform IPs auto-trusted
4. **CI/CD**: Use Redis service in GitHub Actions or test containers

## Troubleshooting

If you still have issues after adding your IP:

1. **Check Valkey status in DigitalOcean dashboard**
2. **Verify the connection string hasn't changed**
3. **Try connecting from a DigitalOcean droplet in the same region**
4. **Check if your ISP uses dynamic IPs (may need to update trusted sources regularly)**

## Security Note

- Never add `0.0.0.0/0` (all IPs) to trusted sources
- Use specific IPs or CIDR ranges only
- For dynamic IPs, consider using a VPN with static IP or SSH tunnel through a trusted server