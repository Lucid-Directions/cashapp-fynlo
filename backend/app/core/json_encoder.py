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
        # Extract seen set from kwargs or create new one
        self._seen = kwargs.pop('_seen', set())
        super().__init__(*args, **kwargs)
    
    def encode(self, obj: Any) -> str:
        """Override encode to maintain seen set across the entire encoding process"""
        # Clear seen set at the start of a new top-level encoding
        if not self._seen:
            self._seen = set()
        return super().encode(obj)
    
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
                    result = {}
                    for k, v in obj.__dict__.items():
                        if not k.startswith('_'):
                            # Recursively process nested values
                            result[k] = self._encode_value(v)
                    return result
                finally:
                    # Remove from seen set after processing
                    self._seen.discard(obj_id)
            return super().default(obj)
        except Exception:
            # If all else fails, return string representation
            return str(obj)
    
    def _encode_value(self, value: Any) -> Any:
        """Recursively encode a value using the same encoder instance"""
        if value is None:
            return None
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, uuid.UUID):
            return str(value)
        elif isinstance(value, (datetime, date)):
            return value.isoformat()
        elif isinstance(value, Decimal):
            return float(value)
        elif isinstance(value, dict):
            return {k: self._encode_value(v) for k, v in value.items()}
        elif isinstance(value, (list, tuple)):
            return [self._encode_value(item) for item in value]
        elif hasattr(value, '__dict__'):
            # Delegate to default method for complex objects
            return self.default(value)
        else:
            # For any other type, try to convert to string
            return str(value)


def safe_json_dumps(obj: Any) -> str:
    """Safely serialize object to JSON string"""
    return json.dumps(obj, cls=FynloJSONEncoder)


def safe_json_loads(json_str: str) -> Any:
    """Safely deserialize JSON string to object"""
    return json.loads(json_str)