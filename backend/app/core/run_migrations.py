"""
Run Alembic migrations on app startup
"""
import logging
from alembic import command
from alembic.config import Config
import os

logger = logging.getLogger(__name__)


def run_migrations():
    """Run pending Alembic migrations"""
    try:
        # Get the alembic.ini path relative to the backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        alembic_ini_path = os.path.join(backend_dir, "alembic.ini")

        if not os.path.exists(alembic_ini_path):
            logger.warning(f"alembic.ini not found at {alembic_ini_path}")
            return

        logger.info("🔄 Running database migrations...")
        logger.info(f"Migration config path: {alembic_ini_path}")

        # Create Alembic configuration
        alembic_cfg = Config(alembic_ini_path)

        # Run migrations
        command.upgrade(alembic_cfg, "head")

        logger.info("✅ Database migrations completed successfully")

    except Exception as e:
        # Log error but don't crash the app
        logger.error(f"❌ Error running migrations: {str(e)}")
        logger.error(f"Migration error type: {type(e).__name__}")
        import traceback

        logger.error(f"Full traceback: {traceback.format_exc()}")
        # In production, we might want to alert but continue
        # The app might still work with existing schema
