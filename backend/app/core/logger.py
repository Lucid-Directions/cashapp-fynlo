"""
Centralized logging configuration for Fynlo POS
Provides structured logging with proper formatting and levels
"""

import logging
import sys
from datetime import datetime
from typing import Optional
import json
from pythonjsonlogger import jsonlogger

from app.core.config import settings

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging"""
    
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        
        # Add timestamp in ISO format
        log_record['timestamp'] = datetime.utcnow().isoformat()
        
        # Add log level
        log_record['level'] = record.levelname
        
        # Add module and function information
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add environment
        log_record['environment'] = settings.ENVIRONMENT
        
        # Remove internal fields
        if 'message' in log_record and 'msg' in log_record:
            del log_record['msg']
        if 'levelname' in log_record:
            del log_record['levelname']

def setup_logger(name: str = "fynlo", level: Optional[str] = None) -> logging.Logger:
    """
    Set up logger with appropriate formatter and handlers
    
    Args:
        name: Logger name
        level: Logging level (defaults to settings.LOG_LEVEL)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Clear existing handlers
    logger.handlers = []
    
    # Valid log levels
    VALID_LOG_LEVELS = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    
    # Set log level with validation and fallback
    log_level_name = (level or getattr(settings, 'LOG_LEVEL', 'INFO')).upper()
    
    if log_level_name in VALID_LOG_LEVELS:
        log_level = VALID_LOG_LEVELS[log_level_name]
    else:
        # Log warning and fall back to INFO
        print(f"Warning: Invalid log level '{log_level_name}'. Valid levels are: {', '.join(VALID_LOG_LEVELS.keys())}. Falling back to INFO.")
        log_level = logging.INFO
    
    logger.setLevel(log_level)
    
    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    
    # Use JSON formatting in production, simple formatting in development
    if settings.ENVIRONMENT == "production":
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Prevent propagation to avoid duplicate logs
    logger.propagate = False
    
    return logger

# Create default logger instance
logger = setup_logger()

# Convenience functions for structured logging
def log_api_request(method: str, path: str, user_id: Optional[str] = None, **kwargs):
    """Log API request with structured data"""
    logger.info(
        "API Request",
        extra={
            "event": "api_request",
            "method": method,
            "path": path,
            "user_id": user_id,
            **kwargs
        }
    )

def log_api_response(method: str, path: str, status_code: int, duration_ms: float, **kwargs):
    """Log API response with structured data"""
    logger.info(
        "API Response",
        extra={
            "event": "api_response",
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            **kwargs
        }
    )

def log_error(error_type: str, message: str, **kwargs):
    """Log error with structured data"""
    logger.error(
        message,
        extra={
            "event": "error",
            "error_type": error_type,
            **kwargs
        }
    )

def log_websocket_event(event_type: str, user_id: Optional[str] = None, **kwargs):
    """Log WebSocket event with structured data"""
    logger.info(
        f"WebSocket {event_type}",
        extra={
            "event": "websocket",
            "event_type": event_type,
            "user_id": user_id,
            **kwargs
        }
    )

def log_payment_event(event_type: str, order_id: str, amount: float, **kwargs):
    """Log payment event with structured data"""
    logger.info(
        f"Payment {event_type}",
        extra={
            "event": "payment",
            "event_type": event_type,
            "order_id": order_id,
            "amount": amount,
            **kwargs
        }
    )

def log_cache_event(event_type: str, key: str, hit: bool = False, **kwargs):
    """Log cache event with structured data"""
    logger.debug(
        f"Cache {event_type}",
        extra={
            "event": "cache",
            "event_type": event_type,
            "key": key,
            "hit": hit,
            **kwargs
        }
    )

def log_database_query(query_type: str, table: str, duration_ms: float, **kwargs):
    """Log database query with structured data"""
    level = logging.WARNING if duration_ms > 1000 else logging.DEBUG
    logger.log(
        level,
        f"Database {query_type}",
        extra={
            "event": "database",
            "query_type": query_type,
            "table": table,
            "duration_ms": duration_ms,
            **kwargs
        }
    )

# Export logger instance and functions
__all__ = [
    'logger',
    'setup_logger',
    'log_api_request',
    'log_api_response',
    'log_error',
    'log_websocket_event',
    'log_payment_event',
    'log_cache_event',
    'log_database_query'
]