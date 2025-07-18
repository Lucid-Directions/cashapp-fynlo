"""
Application startup handler
Initializes all necessary services and configurations
"""

import asyncio
from app.core.logger import logger
from app.core.database import init_db, engine
from app.core.redis_client import init_redis
from app.services.query_optimizer import query_analyzer
from app.core.websocket import websocket_manager

async def startup_handler():
    """Initialize all services on application startup"""
    logger.info("🚀 Starting application initialization...")
    
    try:
        # Initialize database
        logger.info("📊 Initializing database...")
        await init_db()
        
        # Initialize Redis
        logger.info("🔄 Initializing Redis...")
        await init_redis()
        
        # Initialize WebSocket manager
        logger.info("🔌 Initializing WebSocket manager...")
        await websocket_manager.setup()
        
        # Setup query performance analyzer
        logger.info("📈 Setting up query performance analyzer...")
        query_analyzer.setup(engine)
        
        # Import and initialize rate limiter
        try:
            from app.middleware.rate_limit_middleware import init_fastapi_limiter
            await init_fastapi_limiter()
            logger.info("🛡️ Rate limiter initialized")
        except Exception as e:
            logger.warning(f"⚠️ Rate limiter not initialized: {e}")
        
        logger.info("✅ Application initialization complete!")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize application: {e}")
        raise

async def shutdown_handler():
    """Cleanup on application shutdown"""
    logger.info("🛑 Starting application shutdown...")
    
    try:
        # Close WebSocket connections
        await websocket_manager.close_all_connections()
        
        # Close Redis connections
        from app.core.redis_client import close_redis
        await close_redis()
        
        # Flush any remaining metrics
        from app.services.metrics_collector import metrics_collector
        await metrics_collector.flush_metrics()
        
        logger.info("✅ Application shutdown complete!")
        
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")