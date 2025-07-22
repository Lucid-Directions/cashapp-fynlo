"""
Custom JSON encoder for handling UUID and other non-serializable types
"""
import json
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any


class FynloJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles UUIDs, dates, and decimals"""
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        elif isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif hasattr(obj, '__dict__'):
            # Handle SQLAlchemy models or other objects
            return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
        return super().default(obj)


def safe_json_dumps(obj: Any) -> str:
    """Safely serialize object to JSON string"""
    return json.dumps(obj, cls=FynloJSONEncoder)


def safe_json_loads(json_str: str) -> Any:
    """Safely deserialize JSON string to object"""
    return json.loads(json_str)