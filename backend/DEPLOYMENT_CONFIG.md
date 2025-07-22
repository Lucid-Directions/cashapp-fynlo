# DigitalOcean App Platform Deployment Configuration

## Build & Run Commands

### Build Command (leave blank)
DigitalOcean's Python buildpack handles the build automatically:
- Detects `requirements.txt`
- Installs dependencies
- Creates the container

No custom build command needed unless you have special requirements.

### Run Command
```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${WEB_CONCURRENCY:-1} --log-level info --loop uvloop
```

**Why these flags:**
- `--host 0.0.0.0`: Binds to all network interfaces (required for container)
- `--port ${PORT:-8080}`: Uses DigitalOcean's PORT env var (defaults to 8080)
- `--workers ${WEB_CONCURRENCY:-1}`: Allows scaling via env var (default 1)
- `--log-level info`: Production-appropriate logging (not debug)
- `--loop uvloop`: High-performance event loop for better async performance

### Alternative Production Setup (with Gunicorn)
For better production performance with multiple workers:
```bash
gunicorn app.main:app -w ${WEB_CONCURRENCY:-2} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8080} --log-level info
```

## Environment Variables

Required in DigitalOcean App Platform:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string  
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service key
- `PORT`: (Automatically set by DigitalOcean)

Optional performance tuning:
- `WEB_CONCURRENCY`: Number of worker processes (default: 1)
- `KEEP_ALIVE`: Keep-alive timeout in seconds (default: 5)
- `GRACEFUL_TIMEOUT`: Graceful shutdown timeout (default: 30)

## Procfile Commands

The `Procfile` defines these processes:

### web (main API server)
Starts the FastAPI application with Uvicorn

### release (runs during deployment)
```bash
alembic upgrade head && python seed_chucho_menu.py
```
- Runs database migrations
- Seeds Chucho menu data

This ensures your database is always up-to-date and has the correct menu after each deployment.

## Manual Commands in DigitalOcean Console

If you need to run commands manually:

```bash
# Run migrations
alembic upgrade head

# Seed menu data
python seed_chucho_menu.py

# Create database tables
python -c "from app.core.database import init_db; import asyncio; asyncio.run(init_db())"

# Clear Redis cache
python -c "from app.core.redis import redis_client; import asyncio; asyncio.run(redis_client.get_redis().flushdb())"
```

## Deployment Checklist

1. ✅ Set all required environment variables
2. ✅ Ensure database is accessible from app
3. ✅ Redis is configured and accessible
4. ✅ Run command is specified (or Procfile exists)
5. ✅ Health check endpoint works (`/health`)
6. ✅ Migrations run automatically via release command

## Monitoring

The run command with `--log-level info` provides:
- Request logs (without verbose debug)
- Error traces
- Startup/shutdown events
- Worker process info

For more verbose logging in staging:
```bash
--log-level debug
```

For minimal logging in production:
```bash
--log-level warning --no-access-log
```