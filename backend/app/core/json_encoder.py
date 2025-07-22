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
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._seen = set()  # Track objects to prevent circular references
    
    def default(self, obj: Any) -> Any:
        # Check for circular references
        obj_id = id(obj)
        if obj_id in self._seen:
            # Return a placeholder for circular references
            return f"<Circular Reference: {type(obj).__name__}>"
        
        try:
            if isinstance(obj, uuid.UUID):
                return str(obj)
            elif isinstance(obj, (datetime, date)):
                return obj.isoformat()
            elif isinstance(obj, Decimal):
                return float(obj)
            elif hasattr(obj, '__dict__'):
                # Track this object to prevent circular references
                self._seen.add(obj_id)
                try:
                    # Handle SQLAlchemy models or other objects
                    # Recursively encode nested objects
                    result = {}
                    for k, v in obj.__dict__.items():
                        if not k.startswith('_'):
                            # Recursively apply encoding to nested values
                            result[k] = json.loads(json.dumps(v, cls=FynloJSONEncoder))
                    return result
                finally:
                    # Remove from seen set after processing
                    self._seen.discard(obj_id)
            return super().default(obj)
        except Exception:
            # If all else fails, return string representation
            return str(obj)


def safe_json_dumps(obj: Any) -> str:
    """Safely serialize object to JSON string"""
    return json.dumps(obj, cls=FynloJSONEncoder)


def safe_json_loads(json_str: str) -> Any:
    """Safely deserialize JSON string to object"""
    return json.loads(json_str)