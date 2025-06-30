import logging
import re

DEFAULT_REDACTED_KEYWORDS = [
    "password",
    "token",
    "secret",
    "authorization",
    "card_number",
    "cvv",
    "expiry_date",
    "apikey",
    "access_key",
    "secret_key",
    # Add more keywords as needed
]
REDACTION_PLACEHOLDER = "[REDACTED]"

class SensitiveDataFilter(logging.Filter):
    """
    Log filter to redact sensitive information from log records.
    It redacts values in the `extra` dictionary of a log record
    if their keys match any of the `redacted_keywords`.
    It also attempts to redact well-known sensitive patterns from the log message itself.
    """

    def __init__(self, name="", redacted_keywords=None, placeholder=REDACTION_PLACEHOLDER):
        super().__init__(name)
        self.redacted_keywords = redacted_keywords or DEFAULT_REDACTED_KEYWORDS
        self.placeholder = placeholder
        # Compile regex for message body redaction (e.g., "Authorization: Bearer <token>")
        # This is a simple example; more complex regex might be needed for different formats.
        self.sensitive_patterns = [
            re.compile(rf'("{keyword}":\s*)"([^"]*)"', re.IGNORECASE) for keyword in self.redacted_keywords
        ]
        self.auth_header_pattern = re.compile(r'(Authorization:\s*(?:Bearer|Basic)\s+)[^\s]+', re.IGNORECASE)


    def _redact_dict(self, data_dict):
        if not isinstance(data_dict, dict):
            return data_dict

        clean_dict = {}
        for key, value in data_dict.items():
            if isinstance(value, dict):
                clean_dict[key] = self._redact_dict(value)
            elif isinstance(value, list):
                clean_dict[key] = [self._redact_dict(item) if isinstance(item, dict) else item for item in value]
            elif any(keyword.lower() in key.lower() for keyword in self.redacted_keywords):
                clean_dict[key] = self.placeholder
            else:
                clean_dict[key] = value
        return clean_dict

    def filter(self, record):
        # Redact sensitive data in 'extra' dictionary fields
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            record.extra = self._redact_dict(record.extra.copy())

        # Redact sensitive data from the log message itself
        if record.getMessage() and isinstance(record.msg, str):
            # Ensure args are substituted before redaction if they exist
            # This relies on the default Formatter behavior that getMessage()
            # will format the message if args are present.
            message = record.getMessage()

            # Redact JSON-like key-value pairs in the message string
            for pattern in self.sensitive_patterns:
                message = pattern.sub(rf'\1"{self.placeholder}"', message)

            # Redact common Authorization header patterns
            message = self.auth_header_pattern.sub(rf'\1{self.placeholder}', message)

            # If the message was changed, we need to update record.msg and clear record.message
            # so that the formatter re-evaluates it.
            # However, this can be tricky as record.message is a cached property.
            # A simpler way is to modify args if possible, or directly overwrite msg.
            # For now, we'll assume getMessage() is called by the formatter after filtering.
            # A more robust solution might involve a custom formatter.
            # For this implementation, we'll modify record.msg directly if it was a string.
            # This might not be ideal if record.args were used.
            if message != record.getMessage():
                 record.msg = message # This might break formatting if args were involved
                 record.args = () # Clear args as we've pre-formatted and redacted the message


        # Also, check common attributes like 'args' if they are dicts
        if isinstance(record.args, dict):
            record.args = self._redact_dict(record.args.copy())
        elif isinstance(record.args, tuple):
            new_args = []
            for arg in record.args:
                if isinstance(arg, dict):
                    new_args.append(self._redact_dict(arg.copy()))
                else:
                    new_args.append(arg)
            record.args = tuple(new_args)

        return True

def setup_logging_filters():
    """
    Adds the SensitiveDataFilter to the root logger if in production.
    """
    # This import needs to be here to avoid circular dependency with config
    from app.core.config import settings

    if settings.ENVIRONMENT == "production" or not settings.ERROR_DETAIL_ENABLED:
        # Apply to root logger to catch all logs
        # More specific loggers can be targeted if needed
        logger = logging.getLogger()

        # Check if filter is already added to prevent duplicates during reloads
        has_filter = any(isinstance(f, SensitiveDataFilter) for f in logger.filters)
        if not has_filter:
            sensitive_filter = SensitiveDataFilter()
            logger.addFilter(sensitive_filter)
            # Also add to handlers of the root logger
            for handler in logger.handlers:
                handler.addFilter(sensitive_filter)
            logging.info("SensitiveDataFilter added to production logging.")

# Call this function early in your application startup, for example, in main.py or config.py
# However, to avoid circular imports with config, it's better to call it from main.py
# after settings are loaded.
# setup_logging_filters()
