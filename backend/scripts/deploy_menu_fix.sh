#!/bin/bash
#
# Deployment script to fix menu and other issues on DigitalOcean
# Run this after deployment to ensure Chucho menu is loaded
#

echo "🚀 Running post-deployment fixes..."
echo "=================================="

# Change to backend directory
cd /workspace/backend || exit 1

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Run the menu seed script
echo "🌮 Seeding Chucho menu..."
python run_chucho_menu_seed.py

# Clear Redis cache to ensure fresh data
echo "🧹 Clearing Redis cache..."
python -c "
import os
import asyncio
from app.core.config import settings
from app.core.redis import redis_client

async def clear_cache():
    redis = await redis_client.get_redis()
    if redis:
        await redis.flushdb()
        print('✅ Redis cache cleared')
    else:
        print('⚠️  Could not connect to Redis')

asyncio.run(clear_cache())
" 2>/dev/null || echo "⚠️  Redis cache clearing skipped"

echo "✅ Post-deployment fixes complete!"