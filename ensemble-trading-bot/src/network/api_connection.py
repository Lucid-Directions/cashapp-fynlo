"""
Provides API connection utilities for the Ensemble Trading Bot.

This module contains classes and functions for establishing and managing
connections to various APIs used by the trading bot, with robust error handling
and retry logic.
"""

import os
import time
import logging
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from threading import Lock

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("logs/api_connection.log")],
)
logger = logging.getLogger("api_connection")

# Import network modules
# Removed unused: from .dns_resolver import OANDA_DOMAIN_IPS


# Add this new class for rate limiting
class RateLimiter:
    """
    A token bucket rate limiter implementation to control API request rates.

    This class implements the token bucket algorithm, which allows for:
    - Steady rate of requests over time
    - Some burstiness when needed
    - Protection against API rate limit violations
    """

    def __init__(self, tokens_per_second: float, bucket_size: int):
        """
        Initialize the rate limiter.

        Args:
            tokens_per_second: Rate at which tokens are added to the bucket
            bucket_size: Maximum number of tokens the bucket can hold
        """
        self.tokens_per_second = tokens_per_second
        self.bucket_size = bucket_size
        self.tokens = bucket_size  # Start with a full bucket
        self.last_updated = time.time()
        self.lock = Lock()  # For thread safety

    def _add_tokens(self):
        """Add tokens to the bucket based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_updated
        new_tokens = elapsed * self.tokens_per_second

        # Update token count and timestamp
        self.tokens = min(self.bucket_size, self.tokens + new_tokens)
        self.last_updated = now

    def acquire(self, tokens: int = 1, block: bool = True) -> bool:
        """
        Attempt to acquire tokens from the bucket.

        Args:
            tokens: Number of tokens to acquire
            block: If True, wait until tokens are available

        Returns:
            bool: True if tokens were acquired, False otherwise
        """
        with self.lock:
            self._add_tokens()

            if self.tokens >= tokens:
                # Enough tokens available
                self.tokens -= tokens
                return True
            elif not block:
                # Not enough tokens and not blocking
                return False

            # Calculate wait time for enough tokens
            deficit = tokens - self.tokens
            wait_time = deficit / self.tokens_per_second

            # Log the wait
            logger.info(f"Rate limit reached. Waiting {wait_time:.2f}s for more tokens")

            # Release lock during wait
            self.lock.release()
            try:
                time.sleep(wait_time)
            finally:
                # Reacquire lock
                self.lock.acquire()

            # Recalculate tokens after waiting
            self._add_tokens()
            self.tokens -= tokens
            return True


# Create rate limiters for different APIs
API_RATE_LIMITERS = {
    "oanda": RateLimiter(tokens_per_second=0.5, bucket_size=5),  # 30 requests per minute
    "twelvedata": RateLimiter(tokens_per_second=0.2, bucket_size=3),  # 12 requests per minute
    "newsapi": RateLimiter(tokens_per_second=0.016, bucket_size=2),  # 1 request per minute (60s)
    "gnews": RateLimiter(tokens_per_second=0.008, bucket_size=1),  # 1 request every 2 minutes
    "fred": RateLimiter(tokens_per_second=0.05, bucket_size=2),  # 3 requests per minute
    "x": RateLimiter(tokens_per_second=0.03, bucket_size=3),  # 2 requests per minute
    "default": RateLimiter(tokens_per_second=1.0, bucket_size=10),  # Default for other APIs
}


class APIClient:
    """Base class for API clients"""

    def __init__(self):
        self.session = requests.Session()
        self.api_key = None
        self.base_url = None
        self.rate_limiter_name = "default"  # Default rate limiter to use
        self._request_in_progress = set()  # Track requests in progress to prevent recursion

    def request(self, method, endpoint, params=None, data=None, headers=None, retry_count=0):
        """
        Make a request to the API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            params: URL parameters
            data: Request body data
            headers: HTTP headers
            retry_count: Current retry attempt (internal use for tracking retries)

        Returns:
            Response object or None if request failed
        """
        # Create a unique ID for this request to detect recursion
        request_id = f"{method}-{endpoint}-{retry_count}"
        
        # Check for recursion
        if request_id in self._request_in_progress:
            logger.warning(f"Recursion detected in API request {request_id}. Aborting to prevent stack overflow.")
            return None
            
        # Add to in-progress set
        self._request_in_progress.add(request_id)
        
        try:
            # Get the appropriate rate limiter for this API
            rate_limiter = API_RATE_LIMITERS.get(self.rate_limiter_name, API_RATE_LIMITERS["default"])

            # Acquire a token from the rate limiter before making the request
            rate_limiter.acquire()

            url = f"{self.base_url}{endpoint}" if not endpoint.startswith("http") else endpoint
            headers = headers or {}

            # Add default headers
            headers.update(
                {
                    "User-Agent": "EnsembleTradingBot/1.0",
                    "Content-Type": "application/json",
                    # Add Connection: close header to prevent socket reuse issues
                    "Connection": "close",
                }
            )

            try:
                # Create a new session for each request to avoid connection reuse issues
                if retry_count > 0:
                    session = requests.Session()
                    session.headers.update(headers)
                else:
                    session = self.session
                    
                response = session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=data,
                    headers=headers,
                    timeout=10,  # Add a reasonable timeout
                )

                # Close the response to release resources
                response.close()

                # Handle rate limiting with exponential backoff
                if response.status_code == 429:
                    # Limit the number of retries to prevent recursion depth exceeded
                    if retry_count >= 2:  # Lower max retries from 3 to 2
                        logger.error(
                            f"Maximum retry attempts ({retry_count}) reached for {url}. Rate limiting persists."
                        )
                        return response
                    
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(
                        f"Rate limited by {self.rate_limiter_name} API. Waiting {retry_after}s. Retry {retry_count + 1}/2"
                    )
                    time.sleep(retry_after)
                    
                    # Manually handle retry instead of recursion
                    self._request_in_progress.discard(request_id)
                    return self.request(method, endpoint, params, data, headers, retry_count + 1)

                return response

            except requests.RequestException as e:
                logger.error(f"API request error for {url}: {str(e)}")
                return None
            except Exception as e:
                logger.error(f"Unexpected error in API request for {url}: {str(e)}")
                return None
        finally:
            # Always remove from the in-progress set
            self._request_in_progress.discard(request_id)


class OandaClient(APIClient):
    """Client for interacting with the Oanda API."""

    def __init__(self, practice: bool = True):
        """
        Initialize the Oanda API client.

        Args:
            practice: Whether to use the practice API (default: True)
        """
        # Load environment variables
        load_dotenv()

        # Get API credentials from environment
        api_key = os.getenv("OANDA_API_KEY")
        account_id = os.getenv("OANDA_ACCOUNT_ID")

        if not api_key or not account_id:
            logger.error("Oanda API key or account ID not found in environment variables")
            raise ValueError("Missing Oanda API credentials")

        # Set API URL based on whether using practice or live
        if practice:
            base_url = "https://api-fxpractice.oanda.com"
        else:
            base_url = "https://api-fxtrade.oanda.com"

        # Initialize the parent class
        super().__init__()
        self.base_url = base_url
        self.api_key = api_key
        self.account_id = account_id

        # Set the rate limiter name for this API
        self.rate_limiter_name = "oanda"

        # Create headers with API key
        self.headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Create a session with retry strategy
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.headers.update(self.headers)
        
        # Track operations in progress to prevent recursion
        self._operations_in_progress = set()

    def get_account_summary(self) -> Dict[str, Any]:
        """Get account summary information."""
        # Generate a unique operation ID
        operation_id = f"get_account_summary"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in get_account_summary. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/accounts/{self.account_id}/summary"
            response = self.request("GET", endpoint, headers=self.headers)
            
            if response and response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get account summary: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to get account summary"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)

    def get_instruments(self) -> Dict[str, Any]:
        """Get available instruments."""
        # Generate a unique operation ID
        operation_id = f"get_instruments"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in get_instruments. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/accounts/{self.account_id}/instruments"
            response = self.request("GET", endpoint, headers=self.headers)
            
            if response and response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get instruments: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to get instruments"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)

    def get_candles(
        self, instrument: str, granularity: str = "H1", count: int = 10
    ) -> Dict[str, Any]:
        """Get historical candles for an instrument."""
        # Generate a unique operation ID
        operation_id = f"get_candles-{instrument}-{granularity}-{count}"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in get_candles. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/instruments/{instrument}/candles"
            params = {"granularity": granularity, "count": count}
            response = self.request("GET", endpoint, params=params, headers=self.headers)
            
            if response and response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get candles: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to get candles"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)

    def create_order(
        self,
        instrument: str,
        units: int,
        take_profit: Optional[float] = None,
        stop_loss: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Create a new market order."""
        # Generate a unique operation ID
        operation_id = f"create_order-{instrument}-{units}"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in create_order. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/accounts/{self.account_id}/orders"

            order = {
                "order": {
                    "type": "MARKET",
                    "instrument": instrument,
                    "units": str(units),
                    "timeInForce": "FOK",
                    "positionFill": "DEFAULT",
                }
            }

            if take_profit:
                order["order"]["takeProfitOnFill"] = {"price": str(take_profit)}
            if stop_loss:
                order["order"]["stopLossOnFill"] = {"price": str(stop_loss)}

            response = self.request("POST", endpoint, data=order, headers=self.headers)
            
            if response and response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"Failed to create order: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to create order"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)

    def get_open_positions(self) -> Dict[str, Any]:
        """Get all open positions."""
        # Generate a unique operation ID
        operation_id = f"get_open_positions"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in get_open_positions. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/accounts/{self.account_id}/openPositions"
            response = self.request("GET", endpoint, headers=self.headers)
            
            if response and response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get open positions: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to get open positions"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)

    def get_open_trades(self) -> Dict[str, Any]:
        """Get all open trades."""
        # Generate a unique operation ID
        operation_id = f"get_open_trades"
        
        # Check for recursion
        if operation_id in self._operations_in_progress:
            logger.warning(f"Recursion detected in get_open_trades. Returning error response.")
            return {"status": "error", "message": "Aborted to prevent recursion"}
            
        # Mark operation as in progress
        self._operations_in_progress.add(operation_id)
        
        try:
            endpoint = f"/v3/accounts/{self.account_id}/openTrades"
            response = self.request("GET", endpoint, headers=self.headers)
            
            if response and response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get open trades: {response.status_code if response else 'None'}")
                return {"status": "error", "message": "Failed to get open trades"}
        finally:
            # Always remove from in-progress set
            self._operations_in_progress.discard(operation_id)


class TwelveDataClient(APIClient):
    """Client for interacting with the Twelve Data API."""

    def __init__(self):
        """Initialize the Twelve Data API client."""
        # Load environment variables
        load_dotenv()

        # Get API key from environment
        api_key = os.getenv("TWELVE_DATA_API_KEY")

        if not api_key:
            logger.error("Twelve Data API key not found in environment variables")
            raise ValueError("Missing Twelve Data API credentials")

        # Set up base URL and parameters
        base_url = "https://api.twelvedata.com"

        # Initialize the parent class
        super().__init__()
        self.base_url = base_url
        self.api_key = api_key

    def get_time_series(self, symbol: str, interval: str, outputsize: int = 30) -> Dict[str, Any]:
        """
        Get time series data for a symbol.

        Args:
            symbol: The symbol to get data for (e.g., 'EUR/USD')
            interval: The data interval (e.g., '1h', '1day')
            outputsize: The number of data points to retrieve

        Returns:
            Time series data
        """
        endpoint = "/time_series"
        params = {
            "symbol": symbol,
            "interval": interval,
            "outputsize": outputsize,
            "apikey": self.api_key,
        }
        return self.request("GET", endpoint, params=params)

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        """
        Get the latest quote for a symbol.

        Args:
            symbol: The symbol to get a quote for (e.g., 'EUR/USD')

        Returns:
            Latest quote data
        """
        endpoint = "/quote"
        params = {"symbol": symbol, "apikey": self.api_key}
        return self.request("GET", endpoint, params=params)

    def get_forex_pairs(self) -> Dict[str, Any]:
        """
        Get a list of available forex pairs.

        Returns:
            List of available forex pairs
        """
        endpoint = "/forex_pairs"
        params = {"apikey": self.api_key}
        return self.request("GET", endpoint, params=params)


class NewsAPIClient(APIClient):
    """Client for NewsAPI"""

    def __init__(self):
        """Initialize the NewsAPI client."""
        super().__init__()

        # Set the base URL
        self.base_url = "https://newsapi.org/v2"

        # Get API key from environment
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            logger.warning(
                "NEWS_API_KEY not found in environment. NewsAPI features will be limited."
            )

        self.api_key = api_key

        # Set the rate limiter name for this API
        self.rate_limiter_name = "newsapi"
        
        # Track in-progress requests to prevent recursion
        self._direct_requests_in_progress = set()

    def get_everything(
        self, query: str, from_date: Optional[str] = None, to_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get articles from the 'everything' endpoint.

        Args:
            query: Search query
            from_date: Start date in YYYY-MM-DD format
            to_date: End date in YYYY-MM-DD format

        Returns:
            Dictionary with articles and metadata
        """
        if not self.api_key:
            logger.error("Cannot search news: NEWS_API_KEY not set")
            return {"status": "error", "message": "API key not set"}

        # Instead of using the potentially recursive request method,
        # use a direct approach with manual retries
        endpoint = "/everything"
        params = {
            "q": query,
            "apiKey": self.api_key,
            "pageSize": 10,
            "language": "en",
            "sortBy": "publishedAt",
        }

        # Add date parameters if provided
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        # Use a direct request with manual retries
        return self._make_direct_request(endpoint, params)

    def _make_direct_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a direct request to NewsAPI with manual retry logic.
        
        Args:
            endpoint: API endpoint
            params: URL parameters
            
        Returns:
            Dictionary with API response
        """
        # Generate a unique request ID for detecting recursion
        request_id = f"{endpoint}-{hash(frozenset(params.items()))}"
        
        # Check for recursion
        if request_id in self._direct_requests_in_progress:
            logger.warning(f"Recursion detected in NewsAPI request. Returning error response to prevent stack overflow.")
            return {"status": "error", "message": "Request aborted to prevent recursion"}
            
        # Add to in-progress tracking
        self._direct_requests_in_progress.add(request_id)
        
        try:
            # Get the appropriate rate limiter for this API
            rate_limiter = API_RATE_LIMITERS.get(self.rate_limiter_name, API_RATE_LIMITERS["default"])

            # Create a new session to avoid connection reuse issues
            session = requests.Session()
            session.headers.update({
                "User-Agent": "EnsembleTradingBot/1.0",
                "Content-Type": "application/json",
                "Connection": "close",  # Prevent connection reuse
            })
            
            # Maximum retry attempts
            max_retries = 2  # Reduced from 3 to 2
            
            # Try up to max_retries times
            for retry_count in range(max_retries + 1):  # +1 because we want to try max_retries times after the first attempt
                # Acquire a token from the rate limiter before making the request
                rate_limiter.acquire()
                
                url = f"{self.base_url}{endpoint}"
                
                try:
                    # Make the request with a reasonable timeout
                    response = session.get(url, params=params, timeout=10)
                    
                    # Always close the response to release resources
                    response.close()
                    
                    # Handle rate limiting
                    if response.status_code == 429:
                        if retry_count >= max_retries:
                            logger.error(
                                f"Maximum retry attempts ({max_retries}) reached for {url}. Rate limiting persists."
                            )
                            return {"status": "error", "message": "Maximum retries exceeded due to rate limiting"}
                        
                        # Get retry-after header or default to exponential backoff
                        retry_after = int(response.headers.get("Retry-After", 2 ** retry_count))
                        logger.warning(
                            f"Rate limited by NewsAPI. Waiting {retry_after}s. Retry {retry_count + 1}/{max_retries}"
                        )
                        time.sleep(retry_after)
                        continue  # Try again
                    
                    # For successful responses, parse and return JSON
                    if response.status_code == 200:
                        try:
                            result = response.json()
                            session.close()  # Explicitly close the session
                            return result
                        except ValueError:
                            logger.error("Failed to parse NewsAPI response as JSON")
                            return {"status": "error", "message": "Invalid JSON response"}
                    
                    # Handle other errors
                    error_msg = f"Error {response.status_code}"
                    logger.error(f"NewsAPI request failed: {error_msg}")
                    return {"status": "error", "message": error_msg}
                    
                except requests.RequestException as e:
                    logger.error(f"API request error for {url}: {str(e)}")
                    
                    if retry_count >= max_retries:
                        return {"status": "error", "message": f"Request failed after {max_retries} retries: {str(e)}"}
                    
                    # Wait before retrying
                    backoff_time = 2 ** retry_count
                    logger.warning(f"Network error. Retrying in {backoff_time}s. Attempt {retry_count + 1}/{max_retries}")
                    time.sleep(backoff_time)
                    continue
                    
                except Exception as e:
                    logger.error(f"Unexpected error in API request for {url}: {str(e)}")
                    return {"status": "error", "message": f"Unexpected error: {str(e)}"}
                finally:
                    # Explicitly close the session after each attempt
                    session.close()
            
            # This should only happen if we've exhausted all retries
            return {"status": "error", "message": "Failed to complete request after maximum retries"}
        finally:
            # Always remove from in-progress tracking
            self._direct_requests_in_progress.discard(request_id)

    def get_top_headlines(
        self,
        category: Optional[str] = None,
        country: Optional[str] = None,
        query: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get articles from the 'top-headlines' endpoint.

        Args:
            category: News category
            country: Country code
            query: Search query

        Returns:
            Dictionary with articles and metadata
        """
        if not self.api_key:
            logger.error("Cannot fetch headlines: NEWS_API_KEY not set")
            return {"status": "error", "message": "API key not set"}

        endpoint = "/top-headlines"
        params = {"apiKey": self.api_key, "pageSize": 10}

        # Add optional parameters if provided
        if category:
            params["category"] = category
        if country:
            params["country"] = country
        if query:
            params["q"] = query

        # Use our direct request method with manual retries
        return self._make_direct_request(endpoint, params)


class FREDClient(APIClient):
    """Client for interacting with the FRED API."""

    def __init__(self):
        """Initialize the FRED API client."""
        # Load environment variables
        load_dotenv()

        # Get API key from environment
        api_key = os.getenv("FRED_API_KEY")

        if not api_key:
            logger.error("FRED API key not found in environment variables")
            raise ValueError("Missing FRED API credentials")

        # Set up base URL
        base_url = "https://api.stlouisfed.org/fred"

        # Initialize the parent class
        super().__init__()
        self.base_url = base_url
        self.api_key = api_key

    def get_series(self, series_id: str) -> Dict[str, Any]:
        """
        Get data for a specific time series.

        Args:
            series_id: The FRED series ID (e.g., 'GDP', 'UNRATE')

        Returns:
            Series data
        """
        endpoint = "/series/observations"
        params = {"series_id": series_id, "api_key": self.api_key, "file_type": "json"}
        return self.request("GET", endpoint, params=params)

    def get_series_info(self, series_id: str) -> Dict[str, Any]:
        """
        Get information about a specific time series.

        Args:
            series_id: The FRED series ID (e.g., 'GDP', 'UNRATE')

        Returns:
            Series information
        """
        endpoint = "/series"
        params = {"series_id": series_id, "api_key": self.api_key, "file_type": "json"}
        return self.request("GET", endpoint, params=params)

    def search_series(self, search_text: str, limit: int = 10) -> Dict[str, Any]:
        """
        Search for time series.

        Args:
            search_text: The search query
            limit: Maximum number of results to return

        Returns:
            Search results
        """
        endpoint = "/series/search"
        params = {
            "search_text": search_text,
            "api_key": self.api_key,
            "file_type": "json",
            "limit": limit,
        }
        return self.request("GET", endpoint, params=params)


def get_api_client(api_type):
    """
    Factory function to get an API client instance.

    Args:
        api_type (str): Type of API client to get ('oanda', 'news', 'twelvedata', 'fred', etc.)

    Returns:
        APIClient: An instance of the appropriate API client
    """
    api_type = api_type.lower()

    if api_type == "oanda":
        # Check for credentials but let the OandaClient handle loading them
        if not os.getenv("OANDA_ACCOUNT_ID") or not os.getenv("OANDA_API_KEY"):
            logger.warning("Missing Oanda credentials")
            return None

        # OandaClient constructor only takes a practice parameter
        return OandaClient(practice=True)  # Default to practice mode

    elif api_type == "twelvedata":
        # TwelveDataClient constructor doesn't take parameters
        if not os.getenv("TWELVE_DATA_API_KEY"):
            logger.warning("Missing TwelveData API key")
            return None

        return TwelveDataClient()

    elif api_type == "news":
        # Return the NewsAPI client
        return NewsAPIClient()

    elif api_type == "fred":
        # FREDClient constructor doesn't take parameters
        if not os.getenv("FRED_API_KEY"):
            logger.warning("Missing FRED API key")
            return None

        return FREDClient()

    else:
        logger.warning(f"Unknown API type: {api_type}")
        return None
