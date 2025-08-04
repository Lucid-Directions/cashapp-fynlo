"""
SQL Injection Web Application Firewall (WAF) Middleware
Provides an additional layer of protection against SQL injection attacks
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import QueryParams
from urllib.parse import unquote
import time

from app.core.responses import APIResponseHelper


logger = logging.getLogger(__name__)


class SQLInjectionWAFMiddleware(BaseHTTPMiddleware):
    """
    Web Application Firewall middleware to detect and block SQL injection attempts.
    This provides defense-in-depth security in addition to parameterized queries.
    """

    # SQL injection patterns to detect
    SQL_INJECTION_PATTERNS = [
        # SQL Keywords and commands
        r"\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|where|table|into)\b",
        r"\b(exec|execute)\s*\(",
        r"\b(xp_|sp_)\w+",  # Extended stored procedures
        # SQL comments
        r"(-{2}|/\*|\*/|#)",
        # SQL operators and special characters
        r"(\s|^)'(\s|;|$)",  # Lone quotes
        r";\s*(drop|delete|truncate|update|insert|create|alter)",
        # Boolean-based patterns
        r"(\'|\")\s*(or|and)\s*(\d+\s*=\s*\d+|\'?\w+\'?\s*=\s*\'?\w+\'?)",
        r"\b(or|and)\s+\d+\s*=\s*\d+",
        # Time-based blind SQL injection
        r"\b(sleep|waitfor|delay|benchmark|pg_sleep)\s*\(",
        # Stacked queries
        r";\s*\b(select|insert|update|delete|drop|create)\b",
        # Common injection endings
        r"(\'|\")\s*;?\s*(-{2}|#|/\*)",
        # Hex injection
        r"0x[0-9a-fA-F]+",
        # Function-based patterns
        r"\b(ascii|char|concat|substring|length|substr|instr|cast|convert)\s*\(",
        # Information schema queries
        r"\b(information_schema|sysobjects|syscolumns|sysusers)\b",
        # Out-of-band attacks
        r"\b(load_file|into\s+(out|dump)file)\b",
    ]

    # Compile patterns for efficiency
    COMPILED_PATTERNS = [
        re.compile(pattern, re.IGNORECASE | re.DOTALL)
        for pattern in SQL_INJECTION_PATTERNS
    ]

    # Suspicious character sequences
    SUSPICIOUS_SEQUENCES = [
        "' or '",
        "' and '",
        "1=1",
        "1' or '1",
        "admin'--",
        "' or 1--",
        "' or true--",
        "') or ('",
        "'; drop",
        "'; delete",
        "'; update",
        "'; insert",
    ]

    # Whitelist of allowed endpoints that might have special requirements
    ENDPOINT_WHITELIST = [
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/metrics",
    ]

    def __init__(self, app, enabled: bool = True, log_attacks: bool = True):
        super().__init__(app)
        self.enabled = enabled
        self.log_attacks = log_attacks
        self.attack_counter = 0

    async def dispatch(self, request: Request, call_next):
        """Process each request through the WAF"""
        if not self.enabled:
            return await call_next(request)

        # Skip whitelisted endpoints
        if any(
            request.url.path.startswith(endpoint)
            for endpoint in self.ENDPOINT_WHITELIST
        ):
            return await call_next(request)

        # Check various parts of the request
        attack_detected = False
        attack_details = []

        # Check URL path
        path_check = self._check_string(request.url.path, "URL path")
        if path_check:
            attack_detected = True
            attack_details.append(path_check)

        # Check query parameters
        if request.url.query:
            query_params = QueryParams(request.url.query)
            for key, value in query_params.items():
                # Check parameter name
                key_check = self._check_string(key, f"Query param name '{key}'")
                if key_check:
                    attack_detected = True
                    attack_details.append(key_check)

                # Check parameter value
                value_check = self._check_string(value, f"Query param '{key}'")
                if value_check:
                    attack_detected = True
                    attack_details.append(value_check)

        # Check request body for POST/PUT/PATCH requests
        if request.method in ["POST", "PUT", "PATCH"]:
            # Clone the request body
            body = await request.body()

            # Check raw body first
            body_text = body.decode("utf-8", errors="ignore")
            body_check = self._check_string(body_text, "Request body")
            if body_check:
                attack_detected = True
                attack_details.append(body_check)

            # Check JSON body if applicable
            if request.headers.get("content-type") == "application/json":
                try:
                    json_body = json.loads(body_text)
                    json_check = self._check_json_recursive(json_body, "JSON body")
                    if json_check:
                        attack_detected = True
                        attack_details.extend(json_check)
                except json.JSONDecodeError:
                    pass

            # Reconstruct request with body
            async def receive():
                return {"type": "http.request", "body": body}

            request = Request(request.scope, receive)

        # Check headers
        for header_name, header_value in request.headers.items():
            # Skip binary headers
            if header_name.lower() in ["authorization", "cookie"]:
                continue

            header_check = self._check_string(header_value, f"Header '{header_name}'")
            if header_check:
                attack_detected = True
                attack_details.append(header_check)

        # If attack detected, block the request
        if attack_detected:
            self.attack_counter += 1

            if self.log_attacks:
                logger.warning(
                    f"SQL Injection attempt blocked: {request.method} {request.url.path}\n"
                    f"Client: {request.client.host if request.client else 'Unknown'}\n"
                    f"Details: {attack_details}\n"
                    f"Total attacks blocked: {self.attack_counter}"
                )

            # Return a generic error to avoid information disclosure
            # Fix: APIResponseHelper.error already returns a JSONResponse, don't wrap it
            return APIResponseHelper.error(
                "Invalid request parameters",
                status_code=400
            )

        # Process the request normally
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-Process-Time"] = str(process_time)

        return response

    def _check_string(self, text: str, context: str) -> Optional[str]:
        """Check a string for SQL injection patterns"""
        if not text:
            return None

        # Decode URL encoding
        decoded_text = unquote(text)

        # Check against compiled regex patterns
        for pattern in self.COMPILED_PATTERNS:
            if pattern.search(decoded_text):
                return f"{context} matches SQL injection pattern"

        # Check for suspicious sequences
        decoded_lower = decoded_text.lower()
        for sequence in self.SUSPICIOUS_SEQUENCES:
            if sequence.lower() in decoded_lower:
                return f"{context} contains suspicious sequence: {sequence}"

        # Check for null bytes
        if "\x00" in decoded_text or "%00" in decoded_text:
            return f"{context} contains null byte"

        return None

    def _check_json_recursive(self, obj: Any, path: str = "") -> List[str]:
        """Recursively check JSON objects for SQL injection"""
        findings = []

        if isinstance(obj, str):
            check = self._check_string(obj, path)
            if check:
                findings.append(check)

        elif isinstance(obj, dict):
            for key, value in obj.items():
                # Check the key itself
                key_check = self._check_string(str(key), f"{path}.{key} (key)")
                if key_check:
                    findings.append(key_check)

                # Check the value
                findings.extend(self._check_json_recursive(value, f"{path}.{key}"))

        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                findings.extend(self._check_json_recursive(item, f"{path}[{i}]"))

        return findings

    def get_stats(self) -> Dict[str, Any]:
        """Get WAF statistics"""
        return {
            "enabled": self.enabled,
            "attacks_blocked": self.attack_counter,
        }

    def reset_stats(self):
        """Reset WAF statistics"""
        self.attack_counter = 0
